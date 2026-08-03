type RankedUser = {
  userId: string;
  wins: number;
  losses: number;
  rank: number;
};

export async function computeRankedUsers(prisma: any): Promise<RankedUser[]> {
  const rows: { userId: string; wins: number; totalGames: number }[] =
    await prisma.$queryRaw`
      SELECT
        gp."userId",
        CAST(COUNT(*) FILTER (WHERE gp.placement = 1) AS INT) AS wins,
        CAST(COUNT(*) AS INT) AS "totalGames"
      FROM "GamePlayer" gp
      JOIN "Game" g ON gp."gameId" = g.id
      WHERE g.status = 'FINISHED'
      GROUP BY gp."userId"
    `;

  // Rank by wins first; tie-break by fewer games played
  const withMatches = [...rows].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.totalGames - b.totalGames;
  });

  const ranked: RankedUser[] = [];
  let rank = 1;
  for (let i = 0; i < withMatches.length; i++) {
    if (i > 0) {
      const prev = withMatches[i - 1];
      const tied =
        withMatches[i].wins === prev.wins &&
        withMatches[i].totalGames === prev.totalGames;
      if (!tied) rank++;
    }
    ranked.push({
      userId: withMatches[i].userId,
      wins: withMatches[i].wins,
      losses: withMatches[i].totalGames - withMatches[i].wins,
      rank,
    });
  }

  // Include users with zero games (rank 0)
  const playedIds = new Set(rows.map((r) => r.userId));
  const allProfiles = await prisma.profile.findMany({
    select: { userId: true },
  });
  for (const p of allProfiles) {
    if (!playedIds.has(p.userId)) {
      ranked.push({ userId: p.userId, wins: 0, losses: 0, rank: 0 });
    }
  }

  return ranked;
}

export async function getLeaderboard(prisma: any) {
  const ranked = await computeRankedUsers(prisma);

  const profiles = await prisma.profile.findMany({
    where: { userId: { in: ranked.map((r) => r.userId) } },
    select: { userId: true, username: true, avatarUrl: true },
  });

  const profileMap = new Map(profiles.map((p) => [p.userId, p]));

  return ranked.map((r) => ({
    rank: r.rank,
    username: profileMap.get(r.userId)?.username ?? "Unknown",
    avatarUrl: profileMap.get(r.userId)?.avatarUrl ?? null,
    wins: r.wins,
    losses: r.losses,
  }));
}