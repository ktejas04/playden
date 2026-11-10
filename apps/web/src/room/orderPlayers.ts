import type { RoomPlayer } from "@playden/protocol";

/** You first; everyone else keeps the server's order, which is the order they joined. */
export function orderPlayers(players: RoomPlayer[], myId: string): RoomPlayer[] {
  const me = players.filter((player) => player.id === myId);
  const others = players.filter((player) => player.id !== myId);
  return [...me, ...others];
}
