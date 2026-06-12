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
import { OrderRealtimeService } from "./order-realtime.service";
import { OrderService } from "./order.service";

type JwtPayload = {
  sub: string;
  email: string;
};

type OrderSocket = Socket & {
  data: {
    user?: {
      id: string;
      email: string;
    };
  };
};

@WebSocketGateway({ namespace: "orders" })
export class OrderGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly orderService: OrderService,
    private readonly realtime: OrderRealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtime.bindServer(server);
  }

  async handleConnection(client: OrderSocket) {
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

  @SubscribeMessage("order:join")
  async joinOrder(
    @ConnectedSocket() client: OrderSocket,
    @MessageBody() payload: { orderId?: string },
  ) {
    const user = client.data.user;
    const orderId = payload?.orderId;

    if (!user || !orderId) {
      client.emit("order:error", { message: "Pedido inválido" });
      return;
    }

    try {
      const detail = await this.orderService.getOrder(user.id, orderId);
      await client.join(OrderRealtimeService.roomName(orderId));
      client.emit("order:detail", detail);
    } catch {
      client.emit("order:error", { message: "Não foi possível acompanhar este pedido" });
    }
  }

  @SubscribeMessage("order:leave")
  async leaveOrder(
    @ConnectedSocket() client: OrderSocket,
    @MessageBody() payload: { orderId?: string },
  ) {
    if (!payload?.orderId) return;
    await client.leave(OrderRealtimeService.roomName(payload.orderId));
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
