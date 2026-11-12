import type { GameEvent } from "@playden/engine";
import type { GameStatus, ServerMessage } from "@playden/protocol";

/** What this device knows about the room's game session: the status, its own view, the last events. */
export interface RoomGame {
  status: GameStatus | null;
  view: unknown;
  /** The latest batch of events, numbered so the same events arriving twice still register. */
  events: { id: number; events: GameEvent[] } | null;
}

export const NO_GAME: RoomGame = { status: null, view: null, events: null };

export type GameMessage = Extract<
  ServerMessage,
  { type: "game.status" | "game.view" | "game.events" }
>;

export function isGameMessage(message: ServerMessage): message is GameMessage {
  return (
    message.type === "game.status" || message.type === "game.view" || message.type === "game.events"
  );
}

export function reduceGame(state: RoomGame, message: GameMessage): RoomGame {
  switch (message.type) {
    case "game.status": {
      // A view belongs to one running or finished session; drop it when that's over.
      const before = state.status?.session;
      const after = message.session;
      const sameGame = after !== null && after.phase !== "setup" && before?.id === after.id;
      return { ...state, status: message, view: sameGame ? state.view : null };
    }
    case "game.view":
      return { ...state, view: message.view };
    case "game.events":
      return { ...state, events: { id: (state.events?.id ?? 0) + 1, events: message.events } };
  }
}

/**
 * How far the server's clock is ahead of this device's, from one ping: the server read its
 * clock about halfway through the round trip. Add it to Date.now() to get server time.
 */
export function clockOffset(sentAt: number, serverTime: number, receivedAt: number): number {
  return serverTime + (receivedAt - sentAt) / 2 - receivedAt;
}
