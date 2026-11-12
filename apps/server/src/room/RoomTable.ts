import type { AnyGame } from "@playden/engine";
import type { ClientMessage, ServerMessage } from "@playden/protocol";
import { findGame } from "../games";
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
  returnToRoom,
  setConfig,
  spectate,
  startGame,
} from "./roomGame";
import {
  gameOf,
  loadTable,
  messagesFor,
  saveTable,
  statusChangedBetween,
  tableDeadline,
} from "./tableSync";

/** What the table needs from its room: connections, who's who, and storage. */
export interface TableRoom {
  storage: DurableObjectStorage;
  allowDevOnlyGames: boolean;
  openSockets(): WebSocket[];
  personOf(ws: WebSocket): Person;
  /** Connected members' ids, longest in the room first. */
  memberIds(): string[];
  hostId(): Promise<string>;
  send(ws: WebSocket, message: ServerMessage): void;
  /** After every saved change: the room re-checks who is host. */
  changed(): Promise<void>;
}

export type TableMessage = Exclude<ClientMessage, { type: "ping" | "remove" }>;

/** Messages only the host may send. */
const HOST_ONLY = new Set<TableMessage["type"]>([
  "game.pick",
  "game.setConfig",
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
 * roomGame.ts, stores the result, sends each connection its own view, and keeps the room's
 * alarm on the game's next deadline. It never knows any game's rules.
 */
export class RoomTable {
  constructor(private readonly room: TableRoom) {}

  /**
   * A new connection hears the session and, if they play or spectate in it, their own view.
   * Someone new is just in the room until they choose to join or spectate.
   */
  async welcome(ws: WebSocket): Promise<void> {
    const table = await loadTable(this.room.storage);
    const viewer = this.room.personOf(ws).id;
    for (const message of messagesFor(table, viewer, { statusChanged: true, events: [] })) {
      this.room.send(ws, message);
    }
    await this.scheduleAlarm(table);
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
          pickGame(table, person, message.gameId, findGame, {
            allowDevOnly: this.room.allowDevOnlyGames,
          }),
        );
      case "game.setConfig":
        return run((table, game) => needGame(game, (g) => setConfig(table, message.config, g)));
      case "game.join":
        return run((table, game) => needGame(game, (g) => join(table, person, g)));
      case "game.spectate":
        return run((table) => spectate(table, person.id, hostId));
      case "game.leave":
        return run((table, game) => needGame(game, (g) => leave(table, person.id, hostId, g)));
      case "game.start":
        return run((table, game) => needGame(game, (g) => startGame(table, g, randomSeed(), now)));
      case "game.ban":
        return run((table, game) => needGame(game, (g) => ban(table, message.playerId, hostId, g)));
      case "game.end":
        return run((table, game) => needGame(game, (g) => endGame(table, g)));
      case "game.playAgain": {
        const present = this.room.memberIds();
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

  /** Removed from the room (D42): out of the game too. */
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

  /** The room's alarm fired with people in it: it's the game's deadline. */
  async deadlineReached(): Promise<void> {
    const table = await loadTable(this.room.storage);
    const game = gameOf(table);
    const deadline = tableDeadline(table);
    if (!game || deadline === null) return;
    await this.commit(table, fireDeadline(table, game, Math.max(Date.now(), deadline)));
  }

  /** Runs one change asked for by a connection; a refusal goes back to it alone. */
  private async change(
    ws: WebSocket,
    run: (table: TableState, game: AnyGame | undefined) => TableOutcome,
  ): Promise<void> {
    const table = await loadTable(this.room.storage);
    const outcome = run(table, gameOf(table));
    if (!outcome.ok) {
      this.room.send(ws, { type: "error", reason: outcome.reason });
      return;
    }
    await this.commit(table, outcome);
  }

  /** Runs one change the room itself makes; nothing to refuse to. */
  private async apply(
    run: (table: TableState, game: AnyGame | undefined) => TableOutcome,
  ): Promise<void> {
    const table = await loadTable(this.room.storage);
    const outcome = run(table, gameOf(table));
    if (outcome.ok && outcome.table !== table) await this.commit(table, outcome);
  }

  /** Saves the new table, tells each connection what it should hear, and resets the alarm. */
  private async commit(before: TableState, outcome: TableOutcome): Promise<void> {
    if (!outcome.ok) return;
    const { table, events } = outcome;
    if (table === before && events.length === 0) return;
    await saveTable(this.room.storage, table);
    const statusChanged = statusChangedBetween(before, table);
    for (const ws of this.room.openSockets()) {
      const viewer = this.room.personOf(ws).id;
      for (const message of messagesFor(table, viewer, { statusChanged, events })) {
        this.room.send(ws, message);
      }
    }
    await this.scheduleAlarm(table);
    if (statusChanged) await this.room.changed();
  }

  /** While anyone is in the room, the alarm is the game's next deadline (or none). */
  private async scheduleAlarm(table: TableState): Promise<void> {
    if (this.room.openSockets().length === 0) return;
    const deadline = tableDeadline(table);
    if (deadline === null) await this.room.storage.deleteAlarm();
    else await this.room.storage.setAlarm(deadline);
  }
}
