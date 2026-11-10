export interface RoomActor {
  id: string;
  isAdmin: boolean;
}

/** The host or an admin may remove a player; nobody removes themselves or an admin (D42). */
export function canRemovePlayer(actor: RoomActor, target: RoomActor, hostId: string): boolean {
  if (actor.id === target.id || target.isAdmin) return false;
  return actor.isAdmin || actor.id === hostId;
}
