import type { AnyGame } from "@playden/engine";
import { describe, expect, it } from "vitest";
import { findGame } from "../src/games";
import { closingWrites, hostWrites, recordWrites, withRecordId } from "../src/room/gameRecords";
import {
  EMPTY_TABLE,
  type Person,
  type TableOutcome,
  type TableState,
  applyMove,
  ban,
  endGame,
  join,
  leave,
  memberRemoved,
  pickGame,
  playAgain,
  returnToRoom,
  startGame,
} from "../src/room/roomGame";

const tapRace = findGame("tap-race") as AnyGame;
const NOW = 1_000_000;
const ROOM = "room-1";
const [asha, ben, chi, dev] = (["Asha", "Ben", "Chi", "Dev"] as const).map((name): Person => ({
  id: name.toLowerCase(),
  name,
})) as [Person, Person, Person, Person];

let nextId = 0;
const newId = () => `game-${++nextId}`;

function ok(outcome: TableOutcome): TableState {
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.table;
}

/** Applies a change the way the room does: the result gets its record id. */
function change(before: TableState, outcome: TableOutcome): TableState {
  return withRecordId(before, ok(outcome), newId);
}

const writesOf = (before: TableState, after: TableState, hostId: string | null = asha.id) =>
  recordWrites(before, after, { roomId: ROOM, hostId, now: NOW, game: tapRace });

function inSetup(): TableState {
  const picked = change(
    EMPTY_TABLE,
    pickGame(EMPTY_TABLE, asha, "tap-race", findGame, { allowDevOnly: true }),
  );
  return change(picked, join(picked, ben, tapRace));
}

function playing(): TableState {
  const setup = inSetup();
  return change(setup, startGame(setup, tapRace, 42, NOW));
}

const recordId = (table: TableState) => table.session?.recordId;

describe("which records a room change writes (D58)", () => {
  it("a new game session opens an active record", () => {
    const picked = change(
      EMPTY_TABLE,
      pickGame(EMPTY_TABLE, asha, "tap-race", findGame, { allowDevOnly: true }),
    );
    expect(recordId(picked)).toBeDefined();
    expect(writesOf(EMPTY_TABLE, picked)).toEqual([
      {
        kind: "gameOpened",
        gameId: recordId(picked),
        roomId: ROOM,
        gameType: "tap-race",
        config: tapRace.defaultConfig,
        createdBy: asha.id,
        at: NOW,
      },
    ]);
  });

  it("changes in setup keep the same record and write nothing", () => {
    const picked = change(
      EMPTY_TABLE,
      pickGame(EMPTY_TABLE, asha, "tap-race", findGame, { allowDevOnly: true }),
    );
    const joined = change(picked, join(picked, ben, tapRace));
    expect(recordId(joined)).toBe(recordId(picked));
    expect(writesOf(picked, joined)).toEqual([]);
  });

  it("switching game in setup deactivates the old record and opens a new one", () => {
    const setup = inSetup();
    const session = setup.session;
    if (!session) throw new Error("No session");
    const switched = withRecordId(
      setup,
      { ...setup, session: { ...session, gameId: "other" } },
      newId,
    );
    expect(recordId(switched)).not.toBe(recordId(setup));
    const writes = writesOf(setup, switched);
    expect(writes.map((w) => w.kind)).toEqual(["gameDeactivated", "gameOpened"]);
    expect(writes[0]).toEqual({ kind: "gameDeactivated", gameId: recordId(setup) });
  });

  it("Start records the players with their teams", () => {
    const setup = inSetup();
    const started = change(setup, startGame(setup, tapRace, 42, NOW));
    expect(writesOf(setup, started)).toEqual([
      {
        kind: "gameStarted",
        gameId: recordId(setup),
        config: tapRace.defaultConfig,
        at: NOW,
        participants: [
          {
            userId: asha.id,
            role: "player",
            team: 0,
            score: null,
            leftEarly: false,
            leaveReason: null,
          },
          {
            userId: ben.id,
            role: "player",
            team: 1,
            score: null,
            leftEarly: false,
            leaveReason: null,
          },
        ],
      },
    ]);
  });

  it("ordinary moves write nothing", () => {
    const game = playing();
    const tapped = change(game, applyMove(game, tapRace, asha.id, { type: "tap" }, NOW));
    expect(writesOf(game, tapped)).toEqual([]);
  });

  it("a finished game records the result, the winning team and the game's summary", () => {
    let game = playing();
    const config = tapRace.defaultConfig as { targetTaps: number };
    let before = game;
    for (let i = 0; i < config.targetTaps; i++) {
      before = game;
      game = change(game, applyMove(game, tapRace, ben.id, { type: "tap" }, NOW + 1 + i));
    }
    const [write] = writesOf(before, game);
    expect(write).toMatchObject({
      kind: "gameEnded",
      gameId: recordId(game),
      status: "finished",
      winningTeam: 1,
      summary: { counts: [0, config.targetTaps], target: config.targetTaps, winningTeam: 1 },
    });
    expect(write?.kind === "gameEnded" && write.participants).toEqual([
      { userId: asha.id, role: "player", team: 0, score: 0, leftEarly: false, leaveReason: null },
      {
        userId: ben.id,
        role: "player",
        team: 1,
        score: config.targetTaps,
        leftEarly: false,
        leaveReason: null,
      },
    ]);
  });

  it("players who leave mid-game are recorded with why: left (the game or the room) or banned", () => {
    let game = inSetup();
    for (const person of [chi, dev]) game = change(game, join(game, person, tapRace));
    game = change(game, startGame(game, tapRace, 42, NOW));
    game = change(game, leave(game, ben.id, asha.id, tapRace));
    game = change(game, ban(game, chi.id, asha.id, tapRace));
    // Dev leaves the room itself mid-game: that frees the seat as "left" too.
    game = change(game, memberRemoved(game, dev.id, tapRace));
    const before = game;
    const ended = change(before, endGame(before, tapRace));
    const [write] = writesOf(before, ended);
    const reasons =
      write?.kind === "gameEnded"
        ? write.participants.map((p) => [p.userId, p.leftEarly, p.leaveReason])
        : [];
    expect(reasons).toEqual([
      [asha.id, false, null],
      [ben.id, true, "left"],
      [chi.id, true, "banned"],
      [dev.id, true, "left"],
    ]);
  });

  it("an early end is recorded as ended_early with no winning team", () => {
    const game = playing();
    const ended = change(game, endGame(game, tapRace));
    expect(writesOf(game, ended)).toEqual([
      expect.objectContaining({ kind: "gameEnded", status: "ended_early", winningTeam: null }),
    ]);
  });

  it("Play again deactivates the finished record and opens a new one", () => {
    const game = playing();
    const ended = change(game, endGame(game, tapRace));
    const again = change(ended, playAgain(ended, tapRace, [asha.id, ben.id]));
    expect(recordId(again)).not.toBe(recordId(ended));
    expect(writesOf(ended, again).map((w) => w.kind)).toEqual(["gameDeactivated", "gameOpened"]);
  });

  it("Return to room deactivates the record", () => {
    const setup = inSetup();
    const idle = change(setup, returnToRoom(setup));
    expect(writesOf(setup, idle)).toEqual([{ kind: "gameDeactivated", gameId: recordId(setup) }]);
  });

  it("closing the room ends a running game early, deactivates it, closes out members and the room", () => {
    const game = playing();
    const writes = closingWrites(game, { roomId: ROOM, now: NOW, game: tapRace });
    expect(writes.map((w) => w.kind)).toEqual([
      "gameEnded",
      "gameDeactivated",
      "membersClosed",
      "roomClosed",
    ]);
    expect(writes[0]).toMatchObject({ status: "ended_early", winningTeam: null });
    expect(writes[2]).toEqual({ kind: "membersClosed", roomId: ROOM, at: NOW });
    expect(writes[3]).toEqual({ kind: "roomClosed", roomId: ROOM, at: NOW });
  });

  it("a host change updates the current game's host", () => {
    const setup = inSetup();
    expect(hostWrites(setup.session, ben.id)).toEqual([
      { kind: "hostChanged", gameId: recordId(setup), hostId: ben.id },
    ]);
    expect(hostWrites(null, ben.id)).toEqual([]);
  });

  it("closing an idle room closes out its members and the room", () => {
    expect(closingWrites(EMPTY_TABLE, { roomId: ROOM, now: NOW, game: undefined })).toEqual([
      { kind: "membersClosed", roomId: ROOM, at: NOW },
      { kind: "roomClosed", roomId: ROOM, at: NOW },
    ]);
  });
});
