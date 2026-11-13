/**
 * Only the host may remove someone from the room, and never themselves. Admins are regular
 * people inside rooms (D59): the host can remove an admin, and an admin who isn't host can't
 * remove anyone. A player seated in a running game is banned from it first (`inRunningGame`).
 */
export function canRemovePlayer(actorId: string, targetId: string, hostId: string): boolean {
  return actorId === hostId && targetId !== actorId;
}
