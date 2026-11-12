import { type GameSession, roleIn } from "@playden/protocol";

/**
 * Who should be host now (docs/design/rooms-and-games.md section 5).
 *
 * `connectedIds` are members with a live connection and `graceIds` members who dropped less
 * than AWAY_GRACE_MS ago (presence.ts), both longest in the room first. A host who is away
 * keeps host through their grace, so a reload or a quick app switch changes nothing; a new
 * host is always someone connected.
 *
 * - Idle: the host stays while in the room; otherwise the longest-present connected member.
 * - Setup: the same, but a connected player is preferred as the next host (the host always plays).
 * - Playing and results (the game session is on): only a player can be host, never a
 *   spectator or someone just in the room. With no connected player, host stays put; in
 *   results the room then closes the session (roomGame.closeIfNoPlayers).
 *
 * A host who comes back doesn't get host back (D40): the caller stores the result.
 */
export function chooseHost({
  current,
  connectedIds,
  graceIds,
  session,
}: {
  current: string;
  connectedIds: readonly string[];
  graceIds: readonly string[];
  session: GameSession | null;
}): string {
  const inRoom = connectedIds.includes(current) || graceIds.includes(current);
  const players = connectedIds.filter((id) => roleIn(session, id) === "player");
  switch (session?.phase) {
    case "playing":
    case "results":
      if (inRoom && roleIn(session, current) === "player") return current;
      return players[0] ?? current;
    case "setup":
      if (inRoom) return current;
      return players[0] ?? connectedIds[0] ?? current;
    default:
      if (inRoom) return current;
      return connectedIds[0] ?? current;
  }
}
