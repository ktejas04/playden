import type { GameDefinition } from "@playden/engine";
import type { ServerMessage } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MOVE_LIMIT } from "../src/config";
import { RoomTable, type TableRoom } from "../src/room/RoomTable";
import { moveLimitFor } from "../src/room/rateLimit";
import type { TableState } from "../src/room/roomGame";
import { TableStore, type Timers, bookAlarm } from "../src/room/tableSync";

/**
 * Live moves and lean saves (D55, task 019b), on the room's table with a toy game: "tap" is a
 * live move (memory only), "bank" an ordinary one (saved). Each viewer's view is their own
 * taps and banked count; the delta is only what changed.
 */
interface ToyState {
  taps: Record<string, number>;
  banked: Record<string, number>;
  endsAt: number;
}
type ToyMove = { type: "tap" } | { type: "bank" };
interface ToyView {
  taps: number;
  banked: number;
}
type ToyDelta = Partial<ToyView>;

const ROUND_MS = 60_000;

function toyGame(
  withDelta: boolean,
): GameDefinition<ToyState, ToyMove, ToyView, Record<string, never>, ToyDelta> {
  const game: GameDefinition<ToyState, ToyMove, ToyView, Record<string, never>, ToyDelta> = {
    id: withDelta ? "toy-delta" : "toy-plain",
    name: "Toy",
    summary: "Tap and bank.",
    minPlayers: 1,
    maxPlayers: 4,
    moveLimit: { perSecond: 20, burst: 20 },
    defaultConfig: {},
    configSchema: z.strictObject({}),
    moveSchema: z.discriminatedUnion("type", [
      z.strictObject({ type: z.literal("tap") }),
      z.strictObject({ type: z.literal("bank") }),
    ]),
    setup: (seats, _config, _seed, now) => ({
      taps: Object.fromEntries(seats.map((s) => [s.id, 0])),
      banked: Object.fromEntries(seats.map((s) => [s.id, 0])),
      endsAt: now + ROUND_MS,
    }),
    validate: () => ({ ok: true }),
    apply: (state, playerId, move) => {
      const taps = state.taps[playerId] ?? 0;
      if (move.type === "tap") {
        return {
          state: { ...state, taps: { ...state.taps, [playerId]: taps + 1 } },
          events: [],
          live: true,
        };
      }
      return {
        state: {
          ...state,
          taps: { ...state.taps, [playerId]: 0 },
          banked: { ...state.banked, [playerId]: (state.banked[playerId] ?? 0) + taps },
        },
        events: [{ type: "banked" }],
      };
    },
    view: (state, viewer) => ({ taps: state.taps[viewer] ?? 0, banked: state.banked[viewer] ?? 0 }),
    nextDeadline: (state) => state.endsAt,
    onDeadline: (state) => ({ state, events: [] }),
    onPlayerLeft: (state) => ({ state, events: [] }),
    result: () => null,
  };
  if (!withDelta) return game;
  return {
    ...game,
    delta: (before, after, viewer) => {
      const was = game.view(before, viewer);
      const now = game.view(after, viewer);
      const change: ToyDelta = {};
      if (was.taps !== now.taps) change.taps = now.taps;
      if (was.banked !== now.banked) change.banked = now.banked;
      return Object.keys(change).length === 0 ? null : change;
    },
    applyDelta: (view, delta) => ({ ...view, ...delta }),
  };
}

/** Just enough Durable Object storage for the table: a map plus a booked alarm. */
function memoryStorage() {
  const data = new Map<string, unknown>();
  let alarm: number | null = null;
  const counts = { puts: 0, alarmWrites: 0 };
  const storage = {
    get: async (key: string) => structuredClone(data.get(key)),
    put: async (key: string, value: unknown) => {
      counts.puts++;
      data.set(key, structuredClone(value));
    },
    getAlarm: async () => alarm,
    setAlarm: async (at: number) => {
      counts.alarmWrites++;
      alarm = at;
    },
    deleteAlarm: async () => {
      counts.alarmWrites++;
      alarm = null;
    },
  };
  return {
    storage: storage as unknown as DurableObjectStorage,
    counts,
    saved: () => data.get("table") as TableState | undefined,
    alarm: () => alarm,
  };
}

/** Timers the test fires by hand. */
function manualTimers() {
  const pending = new Map<number, () => void>();
  let next = 1;
  const timers: Timers = {
    set: (run) => {
      const id = next++;
      pending.set(id, run);
      return id;
    },
    clear: (handle) => pending.delete(handle as number),
  };
  return {
    timers,
    pendingCount: () => pending.size,
    fireAll: () => {
      for (const [id, run] of [...pending]) {
        pending.delete(id);
        run();
      }
    },
  };
}

interface FakeSocket {
  id: string;
  inbox: ServerMessage[];
}

/** A room with Asha (host) and Ben connected, running the toy game. */
async function toyRoom({ withDelta = true }: { withDelta?: boolean } = {}) {
  const game = toyGame(withDelta);
  const mem = memoryStorage();
  const clock = manualTimers();
  let epochs = 0;
  const newStore = () =>
    new TableStore(mem.storage, {
      maxUnsavedMs: 60_000,
      epoch: `epoch-${++epochs}`,
      timers: clock.timers,
    });
  const room = { store: newStore() };
  const sockets: FakeSocket[] = [
    { id: "asha", inbox: [] },
    { id: "ben", inbox: [] },
  ];
  const names: Record<string, string> = { asha: "Asha", ben: "Ben" };
  const calls = { reschedule: 0, recorded: 0, changed: 0 };
  const tableRoom = (): TableRoom => ({
    store: room.store,
    findGame: (id) => (id === game.id ? (game as never) : undefined),
    allowDevOnlyGames: true,
    countdownMs: 0,
    openSockets: () => sockets as unknown as WebSocket[],
    personOf: (ws) => {
      const id = (ws as unknown as FakeSocket).id;
      return { id, name: names[id] ?? id };
    },
    presentIds: async () => sockets.map((s) => s.id),
    hostId: async () => "asha",
    send: (ws, message) => (ws as unknown as FakeSocket).inbox.push(message),
    changed: async () => {
      calls.changed++;
    },
    reschedule: async () => {
      calls.reschedule++;
      const table = await room.store.load();
      const session = table.session;
      await bookAlarm(
        mem.storage,
        session?.phase === "playing" ? game.nextDeadline(session.state as ToyState) : null,
      );
    },
    recorded: async () => {
      calls.recorded++;
    },
  });
  const table = () => new RoomTable(tableRoom());
  const [asha, ben] = sockets as [FakeSocket, FakeSocket];
  const as = (socket: FakeSocket) => socket as unknown as WebSocket;

  await table().handle(as(asha), { type: "game.pick", gameId: game.id });
  await table().handle(as(ben), { type: "game.join" });
  await table().handle(as(asha), { type: "game.start" });
  for (const s of sockets) s.inbox.length = 0;

  const move = (socket: FakeSocket, type: ToyMove["type"]) =>
    table().handle(as(socket), { type: "move", move: { type } });

  /** The room wakes up after sleeping: memory is gone, storage is what it was. */
  const wakeUp = () => {
    room.store = newStore();
  };

  return { mem, clock, room, asha, ben, as, table, move, calls, wakeUp };
}

const stateOf = (table: TableState | undefined) => table?.session?.state as ToyState | undefined;
const ofType =
  <T extends ServerMessage["type"]>(type: T) =>
  (inbox: ServerMessage[]) =>
    inbox.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);
const deltas = ofType("game.delta");
const views = ofType("game.view");

describe("live moves and lean saves (D55)", () => {
  it("a live move is not saved, and the next normal move saves both", async () => {
    const { mem, asha, move } = await toyRoom();
    const putsAtStart = mem.counts.puts;

    await move(asha, "tap");
    await move(asha, "tap");
    expect(mem.counts.puts).toBe(putsAtStart);
    expect(stateOf(mem.saved())?.taps.asha).toBe(0);

    await move(asha, "bank");
    expect(mem.counts.puts).toBe(putsAtStart + 1);
    expect(stateOf(mem.saved())?.banked.asha).toBe(2);
  });

  it("a live move doesn't record, re-check host or touch the alarm", async () => {
    const { asha, move, calls } = await toyRoom();
    const before = { ...calls };
    await move(asha, "tap");
    expect(calls).toEqual(before);
  });

  it("a room that reloads from storage has every normal change and drops only unsaved live ones", async () => {
    const { mem, asha, ben, move, wakeUp, room } = await toyRoom();
    await move(asha, "tap");
    await move(asha, "bank");
    await move(ben, "tap");
    await move(ben, "tap");
    expect(mem.counts.puts).toBeGreaterThan(0);

    wakeUp();
    const state = stateOf(await room.store.load());
    expect(state?.banked.asha).toBe(1);
    expect(state?.taps.ben).toBe(0);
  });

  it("unsaved live moves keep the room awake and are saved when the timer runs out", async () => {
    const { mem, clock, asha, move, room } = await toyRoom();
    await move(asha, "tap");
    await move(asha, "tap");
    expect(room.store.hasUnsaved()).toBe(true);
    expect(clock.pendingCount()).toBe(1);

    clock.fireAll();
    await Promise.resolve();
    expect(stateOf(mem.saved())?.taps.asha).toBe(2);
    expect(room.store.hasUnsaved()).toBe(false);
  });

  it("an ordinary save stops the keep-awake timer", async () => {
    const { clock, asha, move, room } = await toyRoom();
    await move(asha, "tap");
    await move(asha, "bank");
    expect(clock.pendingCount()).toBe(0);
    expect(room.store.hasUnsaved()).toBe(false);
  });

  it("a game with deltas gets numbered deltas, only for viewers whose view changed", async () => {
    const { asha, ben, move } = await toyRoom();
    await move(asha, "tap");
    await move(asha, "tap");
    expect(deltas(asha.inbox).map((m) => [m.seq, m.delta])).toEqual([
      [1, { taps: 1 }],
      [2, { taps: 2 }],
    ]);
    expect(deltas(ben.inbox)).toEqual([]);
    expect(views(asha.inbox)).toEqual([]);

    await move(asha, "bank");
    expect(deltas(asha.inbox).at(-1)).toMatchObject({ seq: 3, delta: { taps: 0, banked: 2 } });
  });

  it("join and resync get the full view, numbered from the last delta", async () => {
    const { asha, ben, as, table, move } = await toyRoom();
    await move(asha, "tap");
    await move(asha, "tap");

    const late: FakeSocket = { id: "asha", inbox: [] };
    await table().welcome(as(late));
    expect(views(late.inbox)).toEqual([
      { type: "game.view", view: { taps: 2, banked: 0 }, epoch: "epoch-1", seq: 2 },
    ]);

    await table().resync(as(ben));
    expect(views(ben.inbox)).toEqual([
      { type: "game.view", view: { taps: 0, banked: 0 }, epoch: "epoch-1", seq: 0 },
    ]);
  });

  it("a room that reloads numbers its deltas under a new epoch", async () => {
    const { asha, move, wakeUp } = await toyRoom();
    await move(asha, "tap");
    wakeUp();
    await move(asha, "tap");
    expect(deltas(asha.inbox).map((m) => [m.epoch, m.seq])).toEqual([
      ["epoch-1", 1],
      ["epoch-2", 1],
    ]);
  });

  it("a game without deltas still gets its whole view after every move", async () => {
    const { asha, move } = await toyRoom({ withDelta: false });
    await move(asha, "tap");
    expect(views(asha.inbox)).toEqual([{ type: "game.view", view: { taps: 1, banked: 0 } }]);
    expect(deltas(asha.inbox)).toEqual([]);
  });

  it("players get the full view when the game starts", async () => {
    const game = await toyRoom();
    // toyRoom clears the inboxes after Start; play again to see a start.
    await game.table().handle(game.as(game.asha), { type: "game.end" });
    await game.table().handle(game.as(game.asha), { type: "game.playAgain" });
    game.asha.inbox.length = 0;
    await game.table().handle(game.as(game.asha), { type: "game.start" });
    expect(views(game.asha.inbox)).toHaveLength(1);
    expect(deltas(game.asha.inbox)).toEqual([]);
  });
});

describe("booking the room's alarm (D55)", () => {
  it("isn't re-booked when the time is unchanged, and is when it changes", async () => {
    const mem = memoryStorage();
    await bookAlarm(mem.storage, 1_000);
    await bookAlarm(mem.storage, 1_000);
    expect(mem.counts.alarmWrites).toBe(1);
    await bookAlarm(mem.storage, 2_000);
    expect(mem.counts.alarmWrites).toBe(2);
    expect(mem.alarm()).toBe(2_000);
    await bookAlarm(mem.storage, null);
    await bookAlarm(mem.storage, null);
    expect(mem.counts.alarmWrites).toBe(3);
    expect(mem.alarm()).toBeNull();
  });

  it("ordinary moves that keep the deadline don't re-book it", async () => {
    const { mem, asha, move } = await toyRoom();
    const booked = mem.counts.alarmWrites;
    await move(asha, "bank");
    await move(asha, "bank");
    expect(mem.counts.alarmWrites).toBe(booked);
  });
});

describe("a game's own move limit (D55)", () => {
  it("replaces the default", () => {
    expect(moveLimitFor(toyGame(true) as never)).toEqual({ perSecond: 20, burst: 20 });
  });

  it("falls back to the platform's default", () => {
    expect(moveLimitFor({})).toEqual(MOVE_LIMIT);
    expect(moveLimitFor(undefined)).toEqual(MOVE_LIMIT);
  });
});
