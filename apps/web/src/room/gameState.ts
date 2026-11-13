import type { GameEvent } from "@playden/engine";
import type { GameStatus, ServerMessage } from "@playden/protocol";

/** What this device knows about the room's game session: the status, its own view, the last events. */
export interface RoomGame {
  status: GameStatus | null;
  view: unknown;
  /** The latest batch of events, numbered so the same events arriving twice still register. */
  events: { id: number; events: GameEvent[] } | null;
  /** Where this view is in the room's numbered deltas (D55); null for games without deltas. */
  sync: { epoch: string; seq: number } | null;
  /** A delta was missed: ask for the full view again (`game.resync`), and wait for it. */
  needsResync: boolean;
}

export const NO_GAME: RoomGame = {
  status: null,
  view: null,
  events: null,
  sync: null,
  needsResync: false,
};

export type GameMessage = Extract<
  ServerMessage,
  { type: "game.status" | "game.view" | "game.delta" | "game.events" }
>;

/** How a game turns its view plus a delta into the new view, by game id; undefined if it can't. */
export type DeltaApplier = (
  gameId: string,
) => ((view: unknown, delta: unknown) => unknown) | undefined;

export function isGameMessage(message: ServerMessage): message is GameMessage {
  return (
    message.type === "game.status" ||
    message.type === "game.view" ||
    message.type === "game.delta" ||
    message.type === "game.events"
  );
}

export function reduceGame(
  state: RoomGame,
  message: GameMessage,
  applierFor?: DeltaApplier,
): RoomGame {
  switch (message.type) {
    case "game.status": {
      // A view belongs to one running or finished session; drop it when that's over.
      const before = state.status?.session;
      const after = message.session;
      const sameGame = after !== null && after.phase !== "setup" && before?.id === after.id;
      return sameGame
        ? { ...state, status: message }
        : { ...state, status: message, view: null, sync: null, needsResync: false };
    }
    case "game.view": {
      const { epoch, seq } = message;
      const sync = epoch !== undefined && seq !== undefined ? { epoch, seq } : null;
      return { ...state, view: message.view, sync, needsResync: false };
    }
    case "game.delta": {
      if (state.needsResync) return state;
      const gameId = state.status?.session?.gameId;
      const apply = gameId ? applierFor?.(gameId) : undefined;
      const { sync } = state;
      const follows = sync !== null && sync.epoch === message.epoch && message.seq === sync.seq + 1;
      if (!apply || state.view === null || !follows) return { ...state, needsResync: true };
      return {
        ...state,
        view: apply(state.view, message.delta),
        sync: { epoch: message.epoch, seq: message.seq },
      };
    }
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
