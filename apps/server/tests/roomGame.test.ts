import type { AnyGame } from "@playden/engine";
import { roleIn } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import { findGame } from "../src/games";
import {
  EMPTY_TABLE,
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
  nextDeadline,
  pickGame,
  playAgain,
  returnToRoom,
  setConfig,
  spectate,
  startGame,
  statusOf,
  viewFor,
} from "../src/room/roomGame";

const tapRace = findGame("tap-race") as AnyGame;
const NOW = 1_000_000;
const [asha, ben, chi, dev] = (["Asha", "Ben", "Chi", "Dev"] as const).map((name): Person => ({
  id: name.toLowerCase(),
  name,
})) as [Person, Person, Person, Person];
const HOST = asha.id;
const find = (id: string) => findGame(id);
const tap = { type: "tap" };

function ok(outcome: TableOutcome): TableState {
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.table;
}

function reason(outcome: TableOutcome): string {
  if (outcome.ok) throw new Error("Expected a refusal");
  return outcome.reason;
}

const session = (table: TableState) => {
  if (!table.session) throw new Error("No session");
  return table.session;
};
const role = (table: TableState, id: string) => roleIn(table.session, id);

/** Asha (host) picks Tap Race; the others join in order. */
function setup(...joiners: Person[]): TableState {
  let table = ok(pickGame(EMPTY_TABLE, asha, "tap-race", find, { allowDevOnly: true }));
  for (const person of joiners) table = ok(join(table, person, tapRace));
  return table;
}

/** A running race: Asha and Chi on team 1, Ben (and Dev) on team 2. */
function playing(...joiners: Person[]): TableState {
  const table = ok(setConfig(setup(...joiners), { targetTaps: 5, roundSeconds: 20 }, tapRace));
  return ok(startGame(table, tapRace, 7, NOW));
}

describe("picking a game", () => {
  it("opens setup with the game's defaults and the host joined", () => {
    const table = setup();
    expect(session(table)).toMatchObject({
      id: 1,
      phase: "setup",
      gameId: "tap-race",
      config: tapRace.defaultConfig,
      players: [{ id: "asha", name: "Asha", team: 0, left: false }],
      spectators: [],
    });
  });

  it("refuses a game that doesn't exist or is dev-only on a real server", () => {
    expect(reason(pickGame(EMPTY_TABLE, asha, "nope", find, { allowDevOnly: true }))).toBe(
      "That game isn't available",
    );
    expect(reason(pickGame(EMPTY_TABLE, asha, "tap-race", find, { allowDevOnly: false }))).toBe(
      "That game isn't available",
    );
  });

  it("switching the game in setup keeps everyone's choice", () => {
    const table = ok(spectate(setup(ben), chi.id, HOST));
    const switched = ok(pickGame(table, asha, "tap-race", find, { allowDevOnly: true }));
    expect(session(switched).players.map((p) => p.id)).toEqual(["asha", "ben"]);
    expect(session(switched).spectators).toEqual(["chi"]);
    expect(session(switched).id).toBe(1);
  });

  it("can't pick while a game runs or shows results", () => {
    expect(reason(pickGame(playing(ben), asha, "tap-race", find, { allowDevOnly: true }))).toBe(
      "Finish this game first",
    );
    const results = ok(endGame(playing(ben), tapRace));
    expect(reason(pickGame(results, asha, "tap-race", find, { allowDevOnly: true }))).toBe(
      "Return to the room first",
    );
  });
});

describe("joining and spectating in setup", () => {
  it("joining puts each newcomer on the smaller team", () => {
    const table = setup(ben, chi, dev);
    expect(session(table).players.map((p) => [p.id, p.team])).toEqual([
      ["asha", 0],
      ["ben", 1],
      ["chi", 0],
      ["dev", 1],
    ]);
  });

  it("players and spectators switch freely until Start", () => {
    let table = setup(ben);
    table = ok(spectate(table, ben.id, HOST));
    expect(role(table, ben.id)).toBe("spectator");
    table = ok(join(table, ben, tapRace));
    expect(role(table, ben.id)).toBe("player");
    expect(session(table).spectators).toEqual([]);
    table = ok(leave(table, ben.id, HOST, tapRace));
    expect(role(table, ben.id)).toBeNull();
  });

  it("the host can't spectate or back out of their own game", () => {
    expect(reason(spectate(setup(), HOST, HOST))).toBe("The host always plays");
    expect(reason(leave(setup(), HOST, HOST, tapRace))).toBe("The host always plays");
  });

  it("refuses a join when the game is full", () => {
    let table = setup();
    for (let i = 0; i < 15; i++) table = ok(join(table, { id: `p${i}`, name: `P${i}` }, tapRace));
    expect(reason(join(table, dev, tapRace))).toBe("Game is full");
  });

  it("joining twice changes nothing", () => {
    const table = setup(ben);
    expect(ok(join(table, ben, tapRace))).toBe(table);
  });

  it("switching is refused once the game has started", () => {
    const table = playing(ben);
    expect(reason(join(table, chi, tapRace))).toBe("The game has already started");
    expect(reason(spectate(table, ben.id, HOST))).toBe("Leave the game first");
  });
});

describe("starting", () => {
  it("explains what's missing", () => {
    expect(reason(startGame(setup(), tapRace, 1, NOW))).toBe("Need 1 more");
  });

  it("seats only the players, in join order, with their teams", () => {
    const table = playing(ben, chi);
    expect(session(table).phase).toBe("playing");
    expect(session(table).state).toMatchObject({ teamOf: { asha: 0, ben: 1, chi: 0 } });
  });

  it("every player's tap counts for their own team (the 'Asha couldn't tap' bug)", () => {
    let table = playing(ben, chi);
    for (const player of [asha, ben, chi]) {
      table = ok(applyMove(table, tapRace, player.id, tap, NOW + 1));
    }
    expect(session(table).state).toMatchObject({ counts: [2, 1] });
  });
});

describe("moves", () => {
  it("refuses moves from spectators and people just in the room", () => {
    const table = ok(spectate(playing(ben), chi.id, HOST));
    expect(reason(applyMove(table, tapRace, chi.id, tap, NOW))).toBe("You're spectating this game");
    expect(reason(applyMove(table, tapRace, dev.id, tap, NOW))).toBe("You're not in this game");
  });

  it("refuses moves before the start and after the end", () => {
    expect(reason(applyMove(setup(ben), tapRace, HOST, tap, NOW))).toBe("The game hasn't started");
    const ended = ok(endGame(playing(ben), tapRace));
    expect(reason(applyMove(ended, tapRace, HOST, tap, NOW))).toBe("The game has ended");
  });

  it("passes the game's own rejection through", () => {
    expect(reason(applyMove(playing(ben), tapRace, HOST, { type: "jump" }, NOW))).toBe(
      "That move isn't valid",
    );
  });

  it("moves to results when the game has a result", () => {
    let table = playing(ben);
    for (let i = 0; i < 5; i++) table = ok(applyMove(table, tapRace, HOST, tap, NOW + i));
    expect(session(table)).toMatchObject({
      phase: "results",
      endedEarly: false,
      result: { winners: ["asha"] },
    });
  });

  it("wakes at the game's deadline and finishes it", () => {
    const table = playing(ben);
    const deadline = nextDeadline(table, tapRace);
    expect(deadline).toBe(NOW + 20_000);
    expect(session(ok(fireDeadline(table, tapRace, deadline ?? 0))).phase).toBe("results");
    expect(nextDeadline(setup(ben), tapRace)).toBeNull();
  });
});

describe("spectating and leaving mid-game", () => {
  it("anyone not playing can choose to spectate mid-game", () => {
    expect(role(ok(spectate(playing(ben), chi.id, HOST)), chi.id)).toBe("spectator");
  });

  it("Leave game frees the seat; the leaver can then spectate but not play", () => {
    let table = ok(leave(playing(ben, chi), chi.id, HOST, tapRace));
    expect(role(table, chi.id)).toBeNull();
    expect(session(table).players.find((p) => p.id === "chi")?.left).toBe(true);
    table = ok(spectate(table, chi.id, HOST));
    expect(role(table, chi.id)).toBe("spectator");
  });

  it("the game ends early when no players are left", () => {
    let table = playing(ben);
    table = ok(leave(table, ben.id, HOST, tapRace));
    expect(session(table).phase).toBe("playing");
    table = ok(leave(table, HOST, HOST, tapRace));
    expect(session(table)).toMatchObject({ phase: "results", endedEarly: true });
  });

  it("removal from the room counts as leaving", () => {
    const table = ok(memberRemoved(playing(ben, chi), chi.id, tapRace));
    expect(session(table).players.find((p) => p.id === "chi")?.left).toBe(true);
    expect(role(ok(memberRemoved(setup(ben), ben.id, tapRace)), ben.id)).toBeNull();
  });
});

describe("banning", () => {
  it("in setup: out of the game, can spectate, can't join again this session", () => {
    let table = ok(ban(setup(ben), ben.id, HOST, tapRace));
    expect(role(table, ben.id)).toBeNull();
    expect(reason(join(table, ben, tapRace))).toBe("You can't play in this game");
    table = ok(spectate(table, ben.id, HOST));
    expect(role(table, ben.id)).toBe("spectator");
  });

  it("mid-game: the seat is freed", () => {
    const table = ok(ban(playing(ben, chi), chi.id, HOST, tapRace));
    expect(session(table).banned).toEqual(["chi"]);
    expect(role(table, chi.id)).toBeNull();
  });

  it("refuses banning yourself or someone not playing", () => {
    expect(reason(ban(playing(ben), HOST, HOST, tapRace))).toBe("You can't ban yourself");
    expect(reason(ban(playing(ben), chi.id, HOST, tapRace))).toBe("They aren't playing");
  });

  it("a ban lasts only for its session", () => {
    let table = ok(ban(playing(ben, chi), chi.id, HOST, tapRace));
    table = ok(endGame(table, tapRace));
    table = ok(playAgain(table, tapRace, ["asha", "ben", "chi"]));
    expect(ok(join(table, chi, tapRace)).session?.players.map((p) => p.id)).toContain("chi");
  });
});

describe("ending", () => {
  it("End game shows standings so far with no winner", () => {
    let table = playing(ben);
    table = ok(applyMove(table, tapRace, HOST, tap, NOW));
    table = ok(endGame(table, tapRace));
    expect(session(table)).toMatchObject({
      phase: "results",
      endedEarly: true,
      result: { winners: [] },
    });
    expect(reason(endGame(setup(ben), tapRace))).toBe("No game is running");
  });

  it("Play again: setup with the same game and settings; players and spectators carry over", () => {
    let table = ok(spectate(playing(ben, chi), dev.id, HOST));
    table = ok(endGame(table, tapRace));
    table = ok(playAgain(table, tapRace, ["asha", "ben", "dev"]));
    expect(session(table)).toMatchObject({
      id: 2,
      phase: "setup",
      config: { targetTaps: 5, roundSeconds: 20 },
      players: [
        { id: "asha", team: 0 },
        { id: "ben", team: 1 },
      ],
      spectators: ["dev"],
      banned: [],
      result: null,
      endedEarly: false,
    });
    expect(session(table).state).toBeNull();
  });

  it("Return to room makes the room idle; not mid-game", () => {
    expect(ok(returnToRoom(setup(ben))).session).toBeNull();
    expect(ok(returnToRoom(ok(endGame(playing(ben), tapRace)))).session).toBeNull();
    expect(reason(returnToRoom(playing(ben)))).toBe("End the game first");
  });
});

describe("after a game with no players left", () => {
  it("closes the session only once none of its players is in the room", () => {
    const results = ok(endGame(playing(ben), tapRace));
    expect(ok(closeIfNoPlayers(results, ["ben", "chi"]))).toBe(results);
    expect(ok(closeIfNoPlayers(results, ["chi"])).session).toBeNull();
    const running = playing(ben);
    expect(ok(closeIfNoPlayers(running, []))).toBe(running);
  });
});

describe("the host always plays", () => {
  it("a new host in setup is seated", () => {
    const table = ok(spectate(setup(ben), ben.id, HOST));
    expect(role(ok(hostPlays(table, ben, tapRace)), ben.id)).toBe("player");
  });

  it("changes nothing outside setup", () => {
    const table = playing(ben);
    expect(ok(hostPlays(table, chi, tapRace))).toBe(table);
  });
});

describe("views and status", () => {
  it("players get their own view, spectators the spectator view, others none", () => {
    const table = ok(spectate(playing(ben), chi.id, HOST));
    expect(viewFor(table, tapRace, HOST)).toMatchObject({ role: "player", team: 0 });
    expect(viewFor(table, tapRace, chi.id)).toMatchObject({ role: "spectator" });
    expect(viewFor(table, tapRace, dev.id)).toBeNull();
    expect(viewFor(setup(ben), tapRace, HOST)).toBeNull();
  });

  it("the status never carries the seed or the engine state", () => {
    const status = statusOf(playing(ben));
    expect(status.session).not.toHaveProperty("seed");
    expect(status.session).not.toHaveProperty("state");
    expect(statusOf(EMPTY_TABLE)).toEqual({ type: "game.status", session: null });
  });
});
