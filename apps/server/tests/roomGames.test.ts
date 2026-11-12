import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { type GameSession, type ServerMessage, roleIn } from "@playden/protocol";
import { connect, createRoom, member, roomStub, snapshotWith } from "./roomKit";

/**
 * Real-socket simulations of game sessions in a room (docs/design/rooms-and-games.md),
 * played with Tap Race. Each test is one scenario from the design doc's test list.
 */

type Socket = Awaited<ReturnType<typeof connect>>;
type Member = Awaited<ReturnType<typeof member>>;

const sessionWhere =
  (match: (session: GameSession | null) => boolean) =>
  (m: ServerMessage): boolean =>
    m.type === "game.status" && match(m.session);
const phaseIs = (phase: GameSession["phase"] | null) =>
  sessionWhere((s) => (s?.phase ?? null) === phase);
const anyView = (m: ServerMessage) => m.type === "game.view";
const errorSaying = (reason: string) => (m: ServerMessage) =>
  m.type === "error" && m.reason === reason;
const hostIs = (id: string) => (m: ServerMessage) => m.type === "snapshot" && m.room.hostId === id;

function viewOf(message: ServerMessage): Record<string, unknown> {
  if (message.type !== "game.view") throw new Error(`Not a view: ${message.type}`);
  return message.view as Record<string, unknown>;
}

function sessionOf(message: ServerMessage): GameSession {
  if (message.type !== "game.status" || !message.session) throw new Error("No session");
  return message.session;
}

const tap = { type: "move", move: { type: "tap" } };
const close = (...sockets: Socket[]) => sockets.forEach((s) => s.ws.close(1000));

interface Person {
  who: Member;
  id: string;
  ws: Socket;
}

/** A room whose first person is host; everyone connected, in order, nobody in a game yet. */
async function room(prefix: string, names: string[]) {
  const accounts = await Promise.all(names.map((name) => member(`${prefix}-${name}`, name)));
  const first = accounts[0];
  if (!first) throw new Error("No people");
  const code = await createRoom(first.cookie);
  const people: Person[] = [];
  for (const [index, who] of accounts.entries()) {
    const ws = await connect(code, who.cookie);
    await ws.next(snapshotWith(index + 1));
    people.push({ who, id: who.user.id, ws });
  }
  return { code, people };
}

/** Everyone in the list hears a status matching `match`. */
async function allHear(people: Person[], match: (m: ServerMessage) => boolean) {
  return Promise.all(people.map((p) => p.ws.next(match)));
}

/** Host picks Tap Race; `joiners` join in order. Returns once all have heard the last join. */
async function setUp(people: Person[], joiners: Person[], config?: unknown) {
  const [host] = people;
  if (!host) throw new Error("No host");
  host.ws.send({ type: "game.pick", gameId: "tap-race" });
  await allHear(people, phaseIs("setup"));
  for (const [index, person] of joiners.entries()) {
    person.ws.send({ type: "game.join" });
    await allHear(
      people,
      sessionWhere((s) => s?.players.length === index + 2),
    );
  }
  if (config) {
    host.ws.send({ type: "game.setConfig", config });
    await allHear(
      people,
      sessionWhere((s) => JSON.stringify(s?.config) === JSON.stringify(config)),
    );
  }
}

async function startGame(people: Person[]) {
  people[0]?.ws.send({ type: "game.start" });
  await allHear(people, phaseIs("playing"));
}

describe("game sessions in a room", () => {
  it("a new connection hears an idle room", async () => {
    const { people } = await room("s-idle", ["Asha"]);
    const [a] = people as [Person];
    expect(await a.ws.next((m) => m.type === "game.status")).toEqual({
      type: "game.status",
      session: null,
    });
    close(a.ws);
  });

  it("picking a game joins the host only; others choose, and switch until Start", async () => {
    const { people } = await room("s-pick", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    a.ws.send({ type: "game.pick", gameId: "tap-race" });
    const [setup] = await allHear(people, phaseIs("setup"));
    expect(sessionOf(setup as ServerMessage).players.map((p) => p.id)).toEqual([a.id]);

    b.ws.send({ type: "game.join" });
    c.ws.send({ type: "game.spectate" });
    const both = sessionWhere((s) => s?.players.length === 2 && s.spectators.length === 1);
    await allHear(people, both);

    b.ws.send({ type: "game.spectate" });
    c.ws.send({ type: "game.join" });
    const swapped = (await a.ws.next(
      sessionWhere((s) => roleIn(s, b.id) === "spectator" && roleIn(s, c.id) === "player"),
    )) as ServerMessage;
    expect(sessionOf(swapped).players.map((p) => [p.id, p.team])).toEqual([
      [a.id, 0],
      [c.id, 1],
    ]);

    a.ws.send({ type: "game.spectate" });
    await a.ws.next(errorSaying("The host always plays"));
    close(a.ws, b.ws, c.ws);
  });

  it("only the host controls the session", async () => {
    const { people } = await room("s-host-only", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, [b]);
    for (const message of [
      { type: "game.pick", gameId: "tap-race" },
      { type: "game.setConfig", config: { targetTaps: 10, roundSeconds: 10 } },
      { type: "game.start" },
      { type: "game.ban", playerId: a.id },
      { type: "game.end" },
      { type: "game.playAgain" },
      { type: "game.returnToRoom" },
    ]) {
      b.ws.send(message);
      await b.ws.next(errorSaying("Only the host can do that"));
    }
    close(a.ws, b.ws);
  });

  it("Start explains what's missing", async () => {
    const { people } = await room("s-need", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, []);
    a.ws.send({ type: "game.start" });
    await a.ws.next(errorSaying("Need 1 more"));
    close(a.ws, b.ws);
  });

  it("three players on two teams: every tap counts for the tapper's own team", async () => {
    const { people } = await room("s-three", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    await setUp(people, [b, c], { targetTaps: 50, roundSeconds: 60 });
    await startGame(people);
    expect(viewOf(await a.ws.next(anyView))).toMatchObject({ role: "player", team: 0 });
    expect(viewOf(await b.ws.next(anyView))).toMatchObject({ role: "player", team: 1 });
    expect(viewOf(await c.ws.next(anyView))).toMatchObject({ role: "player", team: 0 });

    b.ws.send(tap);
    expect(viewOf(await b.ws.next(anyView))).toMatchObject({ ownCount: 1, standing: "ahead" });
    b.ws.send(tap);
    await b.ws.next((m) => m.type === "game.view" && viewOf(m).ownCount === 2);
    a.ws.send(tap);
    c.ws.send(tap);
    await a.ws.next((m) => m.type === "game.view" && viewOf(m).ownCount === 2);
    expect(viewOf(await b.ws.next(anyView))).toMatchObject({ ownCount: 2 });
    close(a.ws, b.ws, c.ws);
  });

  it("a bad move is refused to its sender alone, with the reason", async () => {
    const { people } = await room("s-bad-move", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, [b]);
    await startGame(people);
    b.ws.send({ type: "move", move: { type: "smash" } });
    await b.ws.next(errorSaying("That move isn't valid"));
    close(a.ws, b.ws);
  });

  it("someone arriving mid-game is just in the room until they choose to spectate", async () => {
    const { code, people } = await room("s-arrive", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, [b]);
    await startGame(people);
    await a.ws.next(anyView);

    const late = await member("s-arrive-Chi", "Chi");
    const c = await connect(code, late.cookie);
    const heard = sessionOf(await c.next(phaseIs("playing")));
    expect(roleIn(heard, late.user.id)).toBeNull();
    c.send(tap);
    await c.next(errorSaying("You're not in this game"));

    a.ws.send(tap);
    await a.ws.next((m) => m.type === "game.view" && viewOf(m).ownCount === 1);
    expect(c.inbox.some((m) => m.type === "game.view")).toBe(false);

    c.send({ type: "game.spectate" });
    await c.next(sessionWhere((s) => roleIn(s, late.user.id) === "spectator"));
    expect(viewOf(await c.next(anyView))).toMatchObject({ role: "spectator", counts: [1, 0] });
    c.send(tap);
    await c.next(errorSaying("You're spectating this game"));
    close(a.ws, b.ws, c);
  });

  it("a player who reconnects gets their seat back where it was", async () => {
    const { code, people } = await room("s-reconnect", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, [b]);
    await startGame(people);
    b.ws.send(tap);
    await b.ws.next((m) => m.type === "game.view" && viewOf(m).ownCount === 1);
    b.ws.ws.close(1000);

    const again = await connect(code, b.who.cookie);
    expect(roleIn(sessionOf(await again.next(phaseIs("playing"))), b.id)).toBe("player");
    expect(viewOf(await again.next(anyView))).toMatchObject({ team: 1, ownCount: 1 });
    close(a.ws, again);
  });

  it("the deadline ends the game; players and spectators see the result", async () => {
    const { code, people } = await room("s-deadline", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    await setUp(people, [b], { targetTaps: 50, roundSeconds: 5 });
    c.ws.send({ type: "game.spectate" });
    await allHear(
      people,
      sessionWhere((s) => s?.spectators.length === 1),
    );
    await startGame(people);
    a.ws.send(tap);
    await a.ws.next((m) => m.type === "game.view" && viewOf(m).ownCount === 1);

    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    const ended = sessionOf(await b.ws.next(phaseIs("results")));
    expect(ended.result).toEqual({ scores: { [a.id]: 1, [b.id]: 0 }, winners: [a.id] });
    expect(ended.endedEarly).toBe(false);
    expect(await c.ws.next((m) => m.type === "game.events")).toEqual({
      type: "game.events",
      events: [{ type: "timeUp" }],
    });
    close(a.ws, b.ws, c.ws);
  });

  it("Leave game frees the seat; the leaver can spectate", async () => {
    const { people } = await room("s-leave", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    await setUp(people, [b, c]);
    await startGame(people);
    c.ws.send({ type: "game.leave" });
    const left = sessionOf(
      await a.ws.next(sessionWhere((s) => s?.phase === "playing" && roleIn(s, c.id) === null)),
    );
    expect(left.phase).toBe("playing");
    c.ws.send({ type: "game.spectate" });
    await c.ws.next(sessionWhere((s) => roleIn(s, c.id) === "spectator"));
    await c.ws.next((m) => m.type === "game.view" && viewOf(m).role === "spectator");
    close(a.ws, b.ws, c.ws);
  });

  it("the host leaving the game mid-game passes host to a player, never a spectator", async () => {
    const { people } = await room("s-host-leaves", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    await setUp(people, [c]);
    b.ws.send({ type: "game.spectate" });
    await allHear(
      people,
      sessionWhere((s) => s?.spectators.length === 1),
    );
    await startGame(people);
    a.ws.send({ type: "game.leave" });
    await allHear(people, hostIs(c.id));
    close(a.ws, b.ws, c.ws);
  });

  it("the host dropping mid-game passes host to a connected player", async () => {
    const { people } = await room("s-host-drops", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    await setUp(people, [c]);
    b.ws.send({ type: "game.spectate" });
    await allHear(
      people,
      sessionWhere((s) => s?.spectators.length === 1),
    );
    await startGame(people);
    a.ws.ws.close(1000);
    await b.ws.next(hostIs(c.id));
    close(b.ws, c.ws);
  });

  it("a new host in setup is seated in the game", async () => {
    const { people } = await room("s-new-host", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, []);
    b.ws.send({ type: "game.spectate" });
    await b.ws.next(sessionWhere((s) => roleIn(s, b.id) === "spectator"));
    a.ws.ws.close(1000);
    await b.ws.next(hostIs(b.id));
    await b.ws.next(sessionWhere((s) => roleIn(s, b.id) === "player"));
    close(b.ws);
  });

  it("a ban frees the seat for this session; the banned player can spectate", async () => {
    const { people } = await room("s-ban", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    await setUp(people, [b, c]);
    await startGame(people);
    a.ws.send({ type: "game.ban", playerId: c.id });
    const banned = sessionOf(await c.ws.next(sessionWhere((s) => s?.banned.length === 1)));
    expect(roleIn(banned, c.id)).toBeNull();
    c.ws.send(tap);
    await c.ws.next(errorSaying("You're not in this game"));
    c.ws.send({ type: "game.spectate" });
    await c.ws.next(sessionWhere((s) => roleIn(s, c.id) === "spectator"));
    close(a.ws, b.ws, c.ws);
  });

  it("End game finishes early with no winner", async () => {
    const { people } = await room("s-end", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, [b]);
    await startGame(people);
    a.ws.send({ type: "game.end" });
    const ended = sessionOf(await b.ws.next(phaseIs("results")));
    expect(ended).toMatchObject({ endedEarly: true, result: { winners: [] } });
    close(a.ws, b.ws);
  });

  it("every player leaving ends the game on its own", async () => {
    const { people } = await room("s-all-leave", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, [b]);
    await startGame(people);
    b.ws.send({ type: "game.leave" });
    await a.ws.next(sessionWhere((s) => s?.phase === "playing" && roleIn(s, b.id) === null));
    a.ws.send({ type: "game.leave" });
    expect(sessionOf(await b.ws.next(phaseIs("results")))).toMatchObject({ endedEarly: true });
    close(a.ws, b.ws);
  });

  it("Play again: setup again; players and spectators carry over, others stay in the room", async () => {
    const { people } = await room("s-again", ["Asha", "Ben", "Chi", "Dev"]);
    const [a, b, c, d] = people as [Person, Person, Person, Person];
    await setUp(people, [b], { targetTaps: 50, roundSeconds: 5 });
    c.ws.send({ type: "game.spectate" });
    await allHear(
      people,
      sessionWhere((s) => s?.spectators.length === 1),
    );
    await startGame(people);
    a.ws.send({ type: "game.end" });
    await allHear(people, phaseIs("results"));

    a.ws.send({ type: "game.playAgain" });
    const [again] = await allHear(people, phaseIs("setup"));
    expect(sessionOf(again as ServerMessage)).toMatchObject({
      id: 2,
      config: { targetTaps: 50, roundSeconds: 5 },
      players: [
        { id: a.id, team: 0 },
        { id: b.id, team: 1 },
      ],
      spectators: [c.id],
      result: null,
      endedEarly: false,
    });
    expect(roleIn(sessionOf(again as ServerMessage), d.id)).toBeNull();

    d.ws.send({ type: "game.join" });
    await a.ws.next(sessionWhere((s) => s?.players.length === 3));
    await startGame(people);
    close(a.ws, b.ws, c.ws, d.ws);
  });

  it("the host leaving during results passes host to a player, never to someone not in the game", async () => {
    const { people } = await room("s-results-host", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    await setUp(people, [b]);
    await startGame(people);
    a.ws.send({ type: "game.end" });
    await allHear(people, phaseIs("results"));
    a.ws.ws.close(1000);
    await c.ws.next(hostIs(b.id));
    b.ws.send({ type: "game.playAgain" });
    await c.ws.next(phaseIs("setup"));
    close(b.ws, c.ws);
  });

  it("results with none of the game's players left take the room back to idle", async () => {
    const { people } = await room("s-results-empty", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    await setUp(people, [b]);
    await startGame(people);
    a.ws.send({ type: "game.end" });
    await allHear(people, phaseIs("results"));
    b.ws.ws.close(1000);
    a.ws.ws.close(1000);
    await c.ws.next(phaseIs(null));
    await c.ws.next(hostIs(c.id));
    close(c.ws);
  });

  it("Return to room makes the room idle again", async () => {
    const { people } = await room("s-return", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, [b]);
    a.ws.send({ type: "game.returnToRoom" });
    await allHear(people, phaseIs(null));
    close(a.ws, b.ws);
  });

  it("removing a player from the room mid-game frees their seat", async () => {
    const { people } = await room("s-remove", ["Asha", "Ben", "Chi"]);
    const [a, b, c] = people as [Person, Person, Person];
    await setUp(people, [b, c]);
    await startGame(people);
    a.ws.send({ type: "remove", playerId: c.id });
    const after = sessionOf(
      await b.ws.next(sessionWhere((s) => s?.phase === "playing" && roleIn(s, c.id) === null)),
    );
    expect(after.players.find((p) => p.id === c.id)?.left).toBe(true);
    close(a.ws, b.ws);
  });

  it("Play here mid-game moves the seat to the new device", async () => {
    const { code, people } = await room("s-play-here", ["Asha", "Ben"]);
    const [a, b] = people as [Person, Person];
    await setUp(people, [b]);
    await startGame(people);
    const second = await connect(code, b.who.cookie);
    await b.ws.next((m) => m.type === "replaced");
    expect(viewOf(await second.next(anyView))).toMatchObject({ role: "player", team: 1 });
    second.send(tap);
    await second.next((m) => m.type === "game.view" && viewOf(m).ownCount === 1);
    close(a.ws, second);
  });
});
