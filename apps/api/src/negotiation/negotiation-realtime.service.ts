import { Injectable } from "@nestjs/common";
import type { NegotiationDetail } from "@poke-organizer/shared";
import type { Server } from "socket.io";

@Injectable()
export class NegotiationRealtimeService {
  private server?: Server;

  bindServer(server: Server) {
    this.server = server;
  }

  emitNegotiationDetail(key: string, detail: NegotiationDetail) {
    this.server?.to(NegotiationRealtimeService.roomName(key)).emit("negotiation:detail", detail);
  }

  static roomName(key: string) {
    return `negotiation:${key}`;
  }
}
