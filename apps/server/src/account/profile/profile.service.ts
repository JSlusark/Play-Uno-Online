import { writeFile, unlink } from "fs/promises";
import { mkdirSync } from "fs";
import path from "path";
import sharp from "sharp";
import { computeRankedUsers } from "../leaderboard/leaderboard.service";

const AVATAR_DIR = process.env.AVATAR_DIR || "/app/data/avatars";
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

mkdirSync(AVATAR_DIR, { recursive: true });

// ── Helpers ─────────────────────────────────────────────────────

async function deleteLocalAvatar(avatarUrl: string | null) {
  if (!avatarUrl || !avatarUrl.startsWith("/avatars/")) return;
  const filename = path.basename(avatarUrl);
  if (filename === "default.png") return;
  await unlink(path.join(AVATAR_DIR, filename)).catch(() => {});
}

// ── Public API ──────────────────────────────────────────────────

/** Returns the full profile DTO: user + stats + history. Single call for the profile page. */
export async function getMyProfile(prisma: any, userId: string) {
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      profile: { select: { username: true, avatarUrl: true } },
    },
  });
  if (!profile) return null;

  const [ranked, history] = await Promise.all([
    computeRankedUsers(prisma),
    getUserGameHistory(prisma, userId),
  ]);

  const entry = ranked.find((r) => r.userId === userId);
  const stats = entry
    ? { rank: entry.rank, wins: entry.wins, losses: entry.losses }
    : { rank: null, wins: 0, losses: 0 };

  return { ...profile, stats, history };
}

export async function getUserByUsername(prisma: any, username: string) {
  return prisma.user.findFirst({
    where: { profile: { username } },
    select: {
      id: true,
      createdAt: true,
      profile: { select: { username: true, avatarUrl: true } },
    },
  });
}

export async function getUserGameHistory(prisma: any, userId: string) {
  const games = await prisma.game.findMany({
    where: { players: { some: { userId } } },
    orderBy: [{ endedAt: "desc" }, { createdAt: "desc" }],
    take: 20,
    include: {
      players: {
        include: {
          user: {
            select: {
              id: true,
              profile: { select: { username: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });

  return games.map((game: any) => {
    const me = game.players.find((p: any) => p.userId === userId);
    const opponents = game.players
      .filter((p: any) => p.userId !== userId)
      .map((p: any) => ({
        id: p.userId,
        username: p.user.profile?.username ?? "Player",
        avatar: p.user.profile?.avatarUrl ?? "",
      }));

    return {
      id: game.id,
      result: me?.placement === 1 ? "win" : "loss",
      roomName: game.roomName ?? "Match",
      opponents,
      date: (game.endedAt ?? game.createdAt).toISOString(),
    };
  });
}

export async function uploadAvatar(
  prisma: any,
  userId: string,
  file: { mimetype: string; toBuffer: () => Promise<Buffer> },
) {
  if (!ALLOWED_MIME.includes(file.mimetype))
    return { ok: false as const, error: "only jpeg, png, webp allowed" as const };

  const buffer = await file.toBuffer();
  if (buffer.length > 2 * 1024 * 1024)
    return { ok: false as const, error: "avatar image must be under 2 MB" as const };

  try {
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height || !metadata.format)
      return { ok: false as const, error: "invalid image file" as const };
  } catch {
    return { ok: false as const, error: "invalid image file" as const };
  }

  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { avatarUrl: true },
  });
  await deleteLocalAvatar(existing?.avatarUrl ?? null);

  const filename = `${userId}${EXT[file.mimetype]}`;
  await writeFile(path.join(AVATAR_DIR, filename), buffer);

  const avatarUrl = `/avatars/${filename}`;
  await prisma.profile.upsert({
    where: { userId },
    update: { avatarUrl },
    create: { userId, username: "User", avatarUrl },
  });

  return { ok: true as const, avatarUrl };
}

export async function deleteAvatar(prisma: any, userId: string) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { avatarUrl: true },
  });
  await deleteLocalAvatar(profile?.avatarUrl ?? null);
  await prisma.profile.update({
    where: { userId },
    data: { avatarUrl: null },
  });
  return { ok: true as const };
}
