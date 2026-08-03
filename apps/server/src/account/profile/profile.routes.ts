import * as profileService from "./profile.service";

export async function profileRoutes(app: any) {
  // ── My profile (user + stats + history) ───────────────────────

  app.get("/me", { preHandler: [app.auth] }, async (request: any, reply: any) => {
    const payload = request.user as { sub?: string };
    if (!payload.sub) return reply.code(401).send({ error: "unauthorized" });

    const profile = await profileService.getMyProfile(app.prisma, payload.sub);
    if (!profile) return reply.code(404).send({ error: "user not found" });

    return { user: profile };
  });

  // ── Avatar ────────────────────────────────────────────────────

  app.post(
    "/me/avatar",
    {
      preHandler: [app.auth],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "5 minutes",
          hook: "preHandler",
          keyGenerator: (request: any) =>
            (request.user as { sub?: string })?.sub ?? request.ip,
          errorResponseBuilder: (_req: any, ctx: any) => ({
            statusCode: 429,
            error: "Too Many Requests",
            message: `Too many uploads. Wait ${ctx.after} cooldown`,
          }),
        },
      },
    },
    async (request: any, reply: any) => {
      const payload = request.user as { sub?: string };
      if (!payload.sub) return reply.code(401).send({ error: "unauthorized" });

      const file = await request.file();
      if (!file) return reply.code(400).send({ error: "no file uploaded" });

      const result = await profileService.uploadAvatar(app.prisma, payload.sub, file);
      if (!result.ok) return reply.code(400).send({ error: result.error });

      return reply.send({ avatarUrl: result.avatarUrl });
    },
  );

  app.delete(
    "/me/avatar",
    { preHandler: [app.auth] },
    async (request: any, reply: any) => {
      const payload = request.user as { sub?: string };
      if (!payload.sub) return reply.code(401).send({ error: "unauthorized" });

      await profileService.deleteAvatar(app.prisma, payload.sub);
      return reply.send({ avatarUrl: null });
    },
  );

  // ── Lookup by username ────────────────────────────────────────

  app.get("/:username", async (request: any, reply: any) => {
    const { username } = request.params as { username: string };

    const user = await profileService.getUserByUsername(app.prisma, username);
    if (!user) return reply.code(404).send({ error: "user not found" });

    return { user };
  });
}
