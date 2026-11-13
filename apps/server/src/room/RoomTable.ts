import type { AnyGame } from "@playden/engine";
import type { ClientMessage, ServerMessage } from "@playden/protocol";
import { withRecordId } from "./gameRecords";
import {
  type Person,
  type TableOutcome,
  type TableState,
  applyMove,
  ban,
  closeIfNoPlayers,
  endGame,
  fireDeadline,
  hostPlays,
  join,
  leave,
  memberRemoved,
  pickGame,
  playAgain,
  presenceChanged,
  returnToRoom,
  seatNotice,
  setConfig,
  shuffleTeams,
  spectate,
  startGame,
  switchTeam,
} from "./roomGame";
import {
  type FindGame,
  type TableStore,
  fullViewFor,
  gameOf,
  messagesFor,
  statusChangedBetween,
  tableDeadline,
} from "./tableSync";

/** What the table needs from its room: connections, who's who, and the table in memory. */
export interface TableRoom {
  store: TableStore;
  findGame: FindGame;
  allowDevOnlyGames: boolean;
  /** The 3-2-1 between Start and play. */
  countdownMs: number;
  openSockets(): WebSocket[];
  personOf(ws: WebSocket): Person;
  /** Members in the room (connected, or away within their grace), longest there first. */
  presentIds(): Promise<string[]>;
  hostId(): Promise<string>;
  send(ws: WebSocket, message: ServerMessage): void;
  /** After a saved change to the session: the room re-checks who is host. */
  changed(): Promise<void>;
  /** After every saved change: books the room's one alarm, if its time changed. */
  reschedule(): Promise<void>;
  /** After every saved change: the room queues any writes to the permanent record (D58). */
  recorded(before: TableState, after: TableState): Promise<void>;
}

export type TableMessage = Exclude<
  ClientMessage,
  { type: "ping" | "remove" | "leave" | "game.resync" }
>;

/** Messages only the host may send. */
const HOST_ONLY = new Set<TableMessage["type"]>([
  "game.pick",
  "game.setConfig",
  "game.shuffleTeams",
  "game.start",
  "game.ban",
  "game.end",
  "game.playAgain",
  "game.returnToRoom",
]);

const needGame = (game: AnyGame | undefined, run: (game: AnyGame) => TableOutcome): TableOutcome =>
  game ? run(game) : { ok: false, reason: "No game is being set up" };

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
}

/**
 * The room's game table: runs session controls and moves through the pure functions in
 * roomGame.ts, keeps the result (saved, or in memory for live moves, D55), sends each
 * connection its own view or what changed in it, and keeps the room's alarm on the game's next
 * deadline. It never knows any game's rules.
 */
export class RoomTable {
  constructor(private readonly room: TableRoom) {}

  /**
   * A new connection hears the session and, if they play or spectate in it, their own view.
   * Someone new is just in the room until they choose to join or spectate.
   */
  async welcome(ws: WebSocket): Promise<void> {
    const table = await this.room.store.load();
    const viewer = this.room.personOf(ws).id;
    const messages = messagesFor(null, table, viewer, {
      statusChanged: true,
      events: [],
      find: this.room.findGame,
      numbering: this.room.store,
    });
    for (const message of messages) this.room.send(ws, message);
  }

  /** A device missed a delta (D55): it gets its full view again. */
  async resync(ws: WebSocket): Promise<void> {
    const table = await this.room.store.load();
    const game = gameOf(table, this.room.findGame);
    const full = fullViewFor(table, game, this.room.personOf(ws).id, this.room.store);
    if (full) this.room.send(ws, full);
  }

  async handle(ws: WebSocket, message: TableMessage): Promise<void> {
    const person = this.room.personOf(ws);
    const hostId = await this.room.hostId();
    if (HOST_ONLY.has(message.type) && person.id !== hostId) {
      this.room.send(ws, { type: "error", reason: "Only the host can do that" });
      return;
    }
    const now = Date.now();
    const run = (change: (table: TableState, game: AnyGame | undefined) => TableOutcome) =>
      this.change(ws, change);

    switch (message.type) {
      case "game.pick":
        return run((table) =>
          pickGame(table, person, message.gameId, this.room.findGame, {
            allowDevOnly: this.room.allowDevOnlyGames,
          }),
        );
      case "game.setConfig":
        return run((table, game) => needGame(game, (g) => setConfig(table, message.config, g)));
      case "game.join":
        return run((table, game) => needGame(game, (g) => join(table, person, g)));
      case "game.switchTeam":
        return run((table, game) =>
          needGame(game, (g) => switchTeam(table, person.id, message.team, g)),
        );
      case "game.shuffleTeams":
        return run((table, game) => needGame(game, (g) => shuffleTeams(table, g, randomSeed())));
      case "game.spectate":
        return run((table) => spectate(table, person.id, hostId));
      case "game.leave":
        return this.change(
          ws,
          (table, game) => needGame(game, (g) => leave(table, person.id, hostId, g)),
          (before, after) => seatNotice(before, after, person.id, hostId, "left"),
        );
      case "game.start":
        return run((table, game) =>
          needGame(game, (g) =>
            startGame(table, g, randomSeed(), now, { countdownMs: this.room.countdownMs }),
          ),
        );
      case "game.ban":
        return this.change(
          ws,
          (table, game) => needGame(game, (g) => ban(table, message.playerId, hostId, g)),
          (before, after) => seatNotice(before, after, message.playerId, hostId, "banned"),
        );
      case "game.end":
        return run((table, game) => needGame(game, (g) => endGame(table, g)));
      case "game.playAgain": {
        const present = await this.room.presentIds();
        return run((table, game) => needGame(game, (g) => playAgain(table, g, present)));
      }
      case "game.returnToRoom":
        return run((table) => returnToRoom(table));
      case "move":
        return run((table, game) =>
          needGame(game, (g) => applyMove(table, g, person.id, message.move, now)),
        );
    }
  }

  /** Out of the room (left, removed, or away too long): out of the game too. */
  async memberRemoved(personId: string): Promise<void> {
    await this.apply((table, game) =>
      game ? memberRemoved(table, personId, game) : { ok: true, table, events: [] },
    );
  }

  /** After a game with none of its players left in the room, the room goes back to idle. */
  async closeIfNoPlayers(presentIds: string[]): Promise<void> {
    await this.apply((table) => closeIfNoPlayers(table, presentIds));
  }

  /** The host always plays in setup: a new host is seated when there's room. */
  async hostPlays(host: { id: string; name: string }): Promise<void> {
    await this.apply((table, game) =>
      game ? hostPlays(table, host, game) : { ok: true, table, events: [] },
    );
  }

  /**
   * A member's connection dropped or came back (D56); `awayIds` is everyone away now. Only a
   * running game's players reach the game.
   */
  async presenceChanged(personId: string, awayIds: string[]): Promise<void> {
    const now = Date.now();
    await this.apply((table, game) =>
      game ? presenceChanged(table, game, personId, awayIds, now) : { ok: true, table, events: [] },
    );
  }

  /** The room's alarm fired for the game's deadline. */
  async deadlineReached(): Promise<void> {
    const table = await this.room.store.load();
    const game = gameOf(table, this.room.findGame);
    const deadline = tableDeadline(table, this.room.findGame);
    if (!game || deadline === null) return;
    await this.commit(table, fireDeadline(table, game, Math.max(Date.now(), deadline)));
  }

  /**
   * Runs one change asked for by a connection; a refusal goes back to it alone. `announce`
   * names a notice and who it's for (e.g. a player left mid-game: their teammates).
   */
  private async change(
    ws: WebSocket,
    run: (table: TableState, game: AnyGame | undefined) => TableOutcome,
    announce?: (
      before: TableState,
      after: TableState,
    ) => { notice: ServerMessage; to: string[] } | null,
  ): Promise<void> {
    const table = await this.room.store.load();
    const outcome = run(table, gameOf(table, this.room.findGame));
    if (!outcome.ok) {
      this.room.send(ws, { type: "error", reason: outcome.reason });
      return;
    }
    await this.commit(table, outcome);
    const told = announce?.(table, outcome.table);
    if (told) {
      for (const socket of this.room.openSockets()) {
        if (told.to.includes(this.room.personOf(socket).id)) this.room.send(socket, told.notice);
      }
    }
  }

  /** Runs one change the room itself makes; nothing to refuse to. */
  private async apply(
    run: (table: TableState, game: AnyGame | undefined) => TableOutcome,
  ): Promise<void> {
    const table = await this.room.store.load();
    const outcome = run(table, gameOf(table, this.room.findGame));
    if (outcome.ok && outcome.table !== table) await this.commit(table, outcome);
  }

  /**
   * Keeps the new table and tells each connection what it should hear. A live change (D55)
   * stays in memory and ends there: only the game's state changed, so the session, the record
   * and the alarm are as they were. Any other change is saved once (carrying unsaved live
   * changes with it), recorded (D58), and the alarm is checked.
   */
  private async commit(before: TableState, outcome: TableOutcome): Promise<void> {
    if (!outcome.ok) return;
    const { events } = outcome;
    if (outcome.table === before && events.length === 0) return;
    const live = outcome.live === true;
    const table = live
      ? outcome.table
      : withRecordId(before, outcome.table, () => crypto.randomUUID());
    if (live) {
      this.room.store.keep(table);
    } else {
      await this.room.store.save(table);
      await this.room.recorded(before, table);
    }
    const statusChanged = !live && statusChangedBetween(before, table);
    const options = {
      statusChanged,
      events,
      find: this.room.findGame,
      numbering: this.room.store,
    };
    for (const ws of this.room.openSockets()) {
      const viewer = this.room.personOf(ws).id;
      for (const message of messagesFor(before, table, viewer, options)) {
        this.room.send(ws, message);
      }
    }
    if (live) return;
    if (statusChanged) await this.room.changed();
    await this.room.reschedule();
  }
}
