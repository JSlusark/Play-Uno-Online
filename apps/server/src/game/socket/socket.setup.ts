import { Server as SocketIOServer } from "socket.io";
import { FastifyInstance } from "fastify";
import { createAuthMiddleware } from "./socket.auth";

// Augment Fastify with the `io` decorator
declare module "fastify" {
  interface FastifyInstance {
    io: SocketIOServer;
  }
}

export function setupSocket(app: FastifyInstance) {
  const io = new SocketIOServer(app.server, {
    path: "/socket.io",
    cors: { origin: true },
  });
  app.decorate("io", io);

  // JWT auth middleware — attaches userId, userName, avatarUrl to socket.data
  io.use(createAuthMiddleware(app));

  io.on("connection", (socket) => {
    const { userId, userName } = socket.data as {
      userId: string;
      userName: string;
      avatarUrl: string;
    };

    console.log(`[Socket] ${userName} connected — socketId: ${socket.id}`);

    // TODO: game handlers need to be refactored and registered here 
    // registerRoomHandlers(io, socket);
    // registerGameHandlers(io, socket);
    // registerConnectionHandlers(io, socket);

    socket.on("disconnect", () => {
      console.log(`[Socket] ${userName} disconnected`);
    });
  });

  return io;
}
