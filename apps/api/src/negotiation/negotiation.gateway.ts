import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Server, Socket } from "socket.io";
import { NegotiationRealtimeService } from "./negotiation-realtime.service";
import { NegotiationService } from "./negotiation.service";

type JwtPayload = {
  sub: string;
  email: string;
};

type NegotiationSocket = Socket & {
  data: {
    user?: {
      id: string;
      email: string;
    };
  };
};

@WebSocketGateway({ namespace: "negotiations" })
export class NegotiationGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly negotiationService: NegotiationService,
    private readonly realtime: NegotiationRealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.bindServer(server);
  }

  async handleConnection(client: NegotiationSocket) {
    const token = this.getToken(client);
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
      });
      client.data.user = { id: payload.sub, email: payload.email };
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage("negotiation:join")
  async joinNegotiation(
    @ConnectedSocket() client: NegotiationSocket,
    @MessageBody() payload: { id?: string },
  ) {
    const user = client.data.user;
    const key = payload?.id;
    if (!user || !key) {
      client.emit("negotiation:error", { message: "Negociação inválida" });
      return;
    }

    try {
      const detail = await this.negotiationService.getByKey(user.id, key);
      await client.join(NegotiationRealtimeService.roomName(detail.id));
      client.emit("negotiation:detail", detail);
    } catch {
      client.emit("negotiation:error", { message: "Não foi possível acompanhar esta negociação" });
    }
  }

  @SubscribeMessage("negotiation:leave")
  async leaveNegotiation(
    @ConnectedSocket() client: NegotiationSocket,
    @MessageBody() payload: { id?: string },
  ) {
    if (!payload?.id) return;
    await client.leave(NegotiationRealtimeService.roomName(payload.id));
  }

  private getToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === "string" && authToken.trim()) {
      return authToken;
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice("Bearer ".length);
    }

    return null;
  }
}
