import * as leaderboardService from "./leaderboard.service";

export async function leaderboardRoutes(app: any) {
  // Global leaderboard — no auth required
  app.get("/leaderboard", async () => {
    const data = await leaderboardService.getLeaderboard(app.prisma);
    return { data };
  });
}
