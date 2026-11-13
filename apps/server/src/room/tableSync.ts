import type { AnyGame, GameEvent } from "@playden/engine";
import type { ServerMessage } from "@playden/protocol";
import { findGame } from "../games";
import {
  EMPTY_TABLE,
  type TableState,
  nextDeadline,
  statusOf,
  viewFor,
  viewerKey,
} from "./roomGame";

const TABLE_KEY = "table";

export type FindGame = (id: string) => AnyGame | undefined;

export async function loadTable(storage: DurableObjectStorage): Promise<TableState> {
  return (await storage.get<TableState>(TABLE_KEY)) ?? EMPTY_TABLE;
}

export async function saveTable(storage: DurableObjectStorage, table: TableState): Promise<void> {
  await storage.put(TABLE_KEY, table);
}

export function gameOf(table: TableState, find: FindGame = findGame): AnyGame | undefined {
  return table.session ? find(table.session.gameId) : undefined;
}

export function tableDeadline(table: TableState, find: FindGame = findGame): number | null {
  const game = gameOf(table, find);
  return game ? nextDeadline(table, game) : null;
}

export interface Timers {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const REAL_TIMERS: Timers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * The room's game table, kept in memory once loaded (D55). An ordinary change is saved at once
 * (one row); a live change stays in memory and goes in with the next save. While a live change
 * is unsaved, a timer keeps the room awake (a pending timer stops it sleeping) and saves after
 * `maxUnsavedMs` at the latest, so sleeping never loses it; only a crash or a deploy can.
 *
 * Deltas are numbered per viewer. The numbering lives in memory only, under an `epoch` that is
 * new every time the room loads from storage, so phones notice a reload and ask for a resync.
 */
export class TableStore {
  private table: TableState | null = null;
  private unsavedTimer: unknown = null;
  private readonly seqs = new Map<string, number>();

  constructor(
    private readonly storage: DurableObjectStorage,
    private readonly options: { maxUnsavedMs: number; epoch: string; timers?: Timers },
  ) {}

  get epoch(): string {
    return this.options.epoch;
  }

  async load(): Promise<TableState> {
    this.table ??= await loadTable(this.storage);
    return this.table;
  }

  /** An ordinary change: saved now, together with any unsaved live changes. */
  async save(table: TableState): Promise<void> {
    this.table = table;
    this.stopTimer();
    await saveTable(this.storage, table);
  }

  /** A live change: in memory only, until the next save or the keep-awake timer. */
  keep(table: TableState): void {
    this.table = table;
    if (this.unsavedTimer !== null) return;
    const timers = this.options.timers ?? REAL_TIMERS;
    this.unsavedTimer = timers.set(() => {
      this.unsavedTimer = null;
      if (this.table) void saveTable(this.storage, this.table);
    }, this.options.maxUnsavedMs);
  }

  hasUnsaved(): boolean {
    return this.unsavedTimer !== null;
  }

  /** The room is deleting itself: drop the memory copy and any pending save. */
  forget(): void {
    this.stopTimer();
    this.table = null;
    this.seqs.clear();
  }

  /** The number of the last delta this viewer was sent (0 before any). */
  seqOf(viewerId: string): number {
    return this.seqs.get(viewerId) ?? 0;
  }

  nextSeq(viewerId: string): number {
    const seq = this.seqOf(viewerId) + 1;
    this.seqs.set(viewerId, seq);
    return seq;
  }

  private stopTimer(): void {
    if (this.unsavedTimer === null) return;
    (this.options.timers ?? REAL_TIMERS).clear(this.unsavedTimer);
    this.unsavedTimer = null;
  }
}

/** Numbering for a game with deltas; absent for games that send whole views. */
interface Numbering {
  epoch: string;
  seqOf(viewerId: string): number;
  nextSeq(viewerId: string): number;
}

/** This viewer's full view, numbered for a game with deltas; null for someone just in the room. */
export function fullViewFor(
  table: TableState,
  game: AnyGame | undefined,
  viewerId: string,
  numbering: Numbering,
): ServerMessage | null {
  const view = game ? viewFor(table, game, viewerId) : null;
  if (view === null) return null;
  if (!game?.delta) return { type: "game.view", view };
  return { type: "game.view", view, epoch: numbering.epoch, seq: numbering.seqOf(viewerId) };
}

/**
 * What one connection should hear after the table changes: the status when it changed (or
 * always, for a fresh connection), then, for players and spectators of a running or finished
 * game, their own view or (for a game with deltas, once they have a view) what changed in it,
 * and the events.
 */
export function messagesFor(
  before: TableState | null,
  after: TableState,
  viewerId: string,
  {
    statusChanged,
    events,
    find = findGame,
    numbering,
  }: { statusChanged: boolean; events: GameEvent[]; find?: FindGame; numbering: Numbering },
): ServerMessage[] {
  const messages: ServerMessage[] = [];
  if (statusChanged) messages.push(statusOf(after));
  const game = gameOf(after, find);
  const viewer = game ? viewerKey(after, viewerId) : null;
  if (!game || viewer === null) return messages;

  // A delta needs a view to apply to: this viewer saw this session in the same role before.
  const was = before?.session;
  const hadView =
    before !== null && was?.id === after.session?.id && viewerKey(before, viewerId) === viewer;
  if (game.delta && hadView && was && after.session) {
    const change = game.delta(was.state, after.session.state, viewer);
    if (change !== null) {
      messages.push({
        type: "game.delta",
        epoch: numbering.epoch,
        seq: numbering.nextSeq(viewerId),
        delta: change,
      });
    }
  } else {
    const full = fullViewFor(after, game, viewerId, numbering);
    if (full) messages.push(full);
  }
  if (events.length > 0) messages.push({ type: "game.events", events });
  return messages;
}

export function statusChangedBetween(before: TableState, after: TableState): boolean {
  return JSON.stringify(statusOf(before)) !== JSON.stringify(statusOf(after));
}

/**
 * Books the room's one alarm for `at` (null: none), touching storage only when that differs
 * from what is booked: each booking is a row written (D55).
 */
export async function bookAlarm(
  storage: Pick<DurableObjectStorage, "getAlarm" | "setAlarm" | "deleteAlarm">,
  at: number | null,
): Promise<void> {
  const booked = await storage.getAlarm();
  if (booked === at) return;
  if (at === null) await storage.deleteAlarm();
  else await storage.setAlarm(at);
}
