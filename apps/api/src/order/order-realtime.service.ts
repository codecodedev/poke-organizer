import { Injectable } from "@nestjs/common";
import type { OrderDetail } from "@poke-organizer/shared";
import type { Server } from "socket.io";

@Injectable()
export class OrderRealtimeService {
  private server?: Server;

  bindServer(server: Server) {
    this.server = server;
  }

  emitOrderDetail(orderId: string, detail: OrderDetail) {
    this.server?.to(OrderRealtimeService.roomName(orderId)).emit("order:detail", detail);
  }

  static roomName(orderId: string) {
    return `order:${orderId}`;
  }
}
