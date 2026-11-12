import { type GameSession, roleIn } from "@playden/protocol";

/**
 * Who should be host now (docs/design/rooms-and-games.md section 5). `memberIds` are the
 * connected members, longest in the room first.
 *
 * - Idle: the host stays while connected; otherwise the longest-present member.
 * - Setup: the same, but a connected player is preferred as the next host (the host always plays).
 * - Playing and results (the game session is on): only a player can be host, never a
 *   spectator or someone just in the room. With no connected player, host stays put; in
 *   results the room then closes the session (roomGame.closeIfNoPlayers).
 *
 * A host who comes back doesn't get host back (D40): the caller stores the result.
 */
export function chooseHost({
  current,
  memberIds,
  session,
}: {
  current: string;
  memberIds: readonly string[];
  session: GameSession | null;
}): string {
  const connected = memberIds.includes(current);
  const players = memberIds.filter((id) => roleIn(session, id) === "player");
  switch (session?.phase) {
    case "playing":
    case "results":
      if (players.includes(current)) return current;
      return players[0] ?? current;
    case "setup":
      if (connected) return current;
      return players[0] ?? memberIds[0] ?? current;
    default:
      if (connected) return current;
      return memberIds[0] ?? current;
  }
}
