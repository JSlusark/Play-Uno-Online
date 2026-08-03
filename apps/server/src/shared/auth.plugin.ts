/* 
This file defines a Fastify plugin that sets up authentication using JWT and cookies.
The plugin registers the necessary Fastify plugins for handling cookies and JWTs, 
and it decorates the Fastify instance with an `auth` method that can be used
 to verify JWTs in incoming requests.

 Plugins are a way to encapsulate and reuse functionality in Fastify, this means
 that the plugin can be registered in different parts of the application,
 and it will provide the same functionality wherever it is used.
*/

import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";

declare module "fastify" {
  interface FastifyInstance {
    auth: (request: any, reply: any) => Promise<void>;
  }
}

export const authPlugin = fp(async (app) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing");
  }

  app.register(cookie);
  app.register(jwt, {
    secret: jwtSecret,
    cookie: { cookieName: "token", 
      signed: false // false as we are using JWT signature and verification mechanism by default to make it cryptographically secure
    },
  });

  app.decorate("auth", async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.code(401).send({ error: "unauthorized" });
    }
  });
});