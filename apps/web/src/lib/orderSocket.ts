import { io, type Socket } from "socket.io-client";
import type { OrderDetail } from "@poke-organizer/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

type ServerToClientEvents = {
  "order:detail": (detail: OrderDetail) => void;
  "order:error": (payload: { message: string }) => void;
};

type ClientToServerEvents = {
  "order:join": (payload: { orderId: string }) => void;
  "order:leave": (payload: { orderId: string }) => void;
};

export type OrderSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createOrderSocket(token: string): OrderSocket {
  return io(`${API_URL}/orders`, {
    auth: { token },
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true,
  });
}
