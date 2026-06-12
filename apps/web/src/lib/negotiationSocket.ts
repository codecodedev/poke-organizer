import { io, type Socket } from "socket.io-client";
import type { NegotiationDetail } from "@poke-organizer/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3333";

type ServerToClientEvents = {
  "negotiation:detail": (detail: NegotiationDetail) => void;
  "negotiation:error": (payload: { message: string }) => void;
};

type ClientToServerEvents = {
  "negotiation:join": (payload: { id: string }) => void;
  "negotiation:leave": (payload: { id: string }) => void;
};

export type NegotiationSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createNegotiationSocket(token: string): NegotiationSocket {
  return io(`${API_URL}/negotiations`, {
    auth: { token },
    autoConnect: false,
    transports: ["websocket"],
    withCredentials: true,
  });
}
