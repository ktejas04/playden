import type { GameSession } from "./messages";

/** Someone's part in a game session: playing, spectating, or (null) just in the room. */
export type SessionRole = "player" | "spectator" | null;

export function roleIn(session: GameSession | null, userId: string): SessionRole {
  if (!session) return null;
  if (session.players.some((p) => p.id === userId && !p.left)) return "player";
  if (session.spectators.includes(userId)) return "spectator";
  return null;
}

/** Players still in the game (not left, banned or removed), in join order. */
export function activePlayers(session: GameSession): GameSession["players"] {
  return session.players.filter((p) => !p.left);
}
