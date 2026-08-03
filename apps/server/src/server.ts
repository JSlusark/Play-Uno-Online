/* 
This file is the entry point for the Fastify server.
It sets up the server, registers plugins, defines routes, and starts listening for incoming requests.

*/

import dotenv from "dotenv";
import Fastify from "fastify";

import "./shared/prisma.plugin"; // Load Prisma module augmentation
import { prismaPlugin } from "./shared/prisma.plugin";
import { authPlugin } from "./shared/auth.plugin";
import { rateLimitPlugin } from "./shared/rate-limit.plugin";
import { multipartPlugin } from "./shared/multipart.plugin";
import { authRoutes } from "./account/auth/auth.routes";
import { profileRoutes } from "./account/profile/profile.routes";
import { leaderboardRoutes } from "./account/leaderboard/leaderboard.routes";
import { setupSocket } from "./socket/socket.setup";
import fastifyStatic from "@fastify/static";
import path from "path";

// dotenv.config() loads environment variables from a .env file into process.env.
// This is useful for managing configuration settings like database credentials,
// API keys, and other sensitive information without hardcoding them into the source code.
dotenv.config();

const app = Fastify({ logger: false, trustProxy: true }); // trustProxy: true is important for getting the correct client IP address when behind a reverse proxy (like Nginx or a load balancer).

app.setErrorHandler((err, req, reply) => {
  req.log.error(err);
  if ((err as any).code === 'FST_ERR_VALIDATION') {
    const v = (err as any).validation?.[0];
    const field = v?.instancePath?.replace('/', '') || 'input';
    if (field === 'password' && v?.keyword === 'pattern')
      return reply.code(400).send({ error: 'password must be at least 8 characters and include uppercase, lowercase, and a number' });
    return reply.code(400).send({ error: `${field}: ${v?.message ?? 'invalid'}` });
  }
  reply.code((err as any).statusCode || 500).send(err);
});

// Health check endpoint to verify that the server is running and responsive.
app.get("/api/health", async () => ({ ok: true }));

// Database ping endpoint to verify that the server can connect to the database.
app.get("/api/db/ping", async () => {
  const r = await app.prisma.$queryRaw`SELECT 1 as ok`;
  return { ok: true, r };
});

const port = Number(process.env.PORT || "3000"); 

// The start function initializes the server by registering plugins, routes, and starting the server to listen for incoming requests.
const start = async () => {

  // plugins are a way to encapsulate and reuse functionality in Fastify. They can add decorators, hooks, and routes to the Fastify instance.
  await app.register(prismaPlugin);
  await app.register(authPlugin);
  await app.register(rateLimitPlugin);
  await app.register(multipartPlugin);

  //
  await app.register(fastifyStatic, {
    root: path.join(process.cwd(), "data/avatars"),
    prefix: "/avatars/",
  });

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(profileRoutes, { prefix: "/api/users" });
  await app.register(leaderboardRoutes, { prefix: "/api/users" });

  setupSocket(app);
  await app.listen({ port, host: "0.0.0.0" });
};

start().catch((err) => {
  app.log.error(err);
  process.exit(1);
});