import { Socket } from "socket.io";
import type { SocketAuthData } from "./socket.auth";

/** Returns the authenticated player's identity from socket.data (typed). */
export function getIdentity(socket: Socket) {
  const { userId, userName } = socket.data as SocketAuthData;
  return {
    playerId: userId,
    socketId: socket.id,
    userName,
  };
}

