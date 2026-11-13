import { runInDurableObject } from "cloudflare:test";
import { sketchBattle } from "@playden/game-sketch-battle";
import type {
  SketchBattleDelta,
  SketchBattleState,
  SketchBattleView,
} from "@playden/game-sketch-battle";
import type { ServerMessage } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import type { TableState } from "../src/room/roomGame";
import { connect, createRoom, member, roomStub, settle, snapshotWith } from "./roomKit";

/**
 * Sketch Battle through a real room and real sockets: live moves and deltas (019b, D55),
 * presence (019c, D56) and hidden information on the wire (024, D47).
 */

type Socket = Awaited<ReturnType<typeof connect>>;

/** One person's connection, keeping their view up to date from full views and deltas. */
interface Player {
  id: string;
  name: string;
  cookie: string;
  ws: Socket;
  /** Every message's raw text, to check what reached this device. */
  wire: string[];
  view: SketchBattleView | null;
  seq: number;
}

function follow(player: Player): void {
  player.ws.ws.addEventListener("message", (event) => {
    const text = event.data as string;
    player.wire.push(text);
    const message = JSON.parse(text) as ServerMessage;
    if (message.type === "game.view") {
      player.view = message.view as SketchBattleView;
      player.seq = message.seq ?? 0;
    } else if (message.type === "game.delta" && player.view) {
      expect(message.seq).toBe(player.seq + 1);
      player.seq = message.seq;
      player.view =
        sketchBattle.applyDelta?.(player.view, message.delta as SketchBattleDelta) ?? null;
    }
  });
}

async function reconnect(code: string, player: Player): Promise<void> {
  player.ws = await connect(code, player.cookie);
  player.view = null;
  follow(player);
}

/** Asha (host) and Chi on team 1, Ben and Dev on team 2, playing round 1. */
async function playing(prefix: string) {
  const names = ["Asha", "Ben", "Chi", "Dev"];
  const accounts = await Promise.all(names.map((name) => member(`${prefix}-${name}`, name)));
  const code = await createRoom(accounts[0]?.cookie ?? "");
  const people: Player[] = [];
  for (const [index, account] of accounts.entries()) {
    const ws = await connect(code, account.cookie);
    await ws.next(snapshotWith(index + 1));
    const player: Player = {
      id: account.user.id,
      name: names[index] ?? "",
      cookie: account.cookie,
      ws,
      wire: [],
      view: null,
      seq: 0,
    };
    follow(player);
    people.push(player);
  }
  const [asha, ben, chi, dev] = people as [Player, Player, Player, Player];
  asha.ws.send({ type: "game.pick", gameId: "sketch-battle" });
  await settle();
  for (const p of [ben, chi, dev]) {
    p.ws.send({ type: "game.join" });
    await settle();
  }
  asha.ws.send({ type: "game.start" });
  await until(() => people.every((p) => p.view?.phase === "choose"));
  return { code, people, asha, ben, chi, dev };
}

async function until(check: () => boolean, what = "condition", ms = 2_000): Promise<void> {
  for (let i = 0; i < ms / 10; i++) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

const storedTable = (code: string) =>
  runInDurableObject(roomStub(code), async (_room, state) =>
    state.storage.get<TableState>("table"),
  );
const storedState = async (code: string) =>
  (await storedTable(code))?.session?.state as SketchBattleState | undefined;

function viewOf(player: Player): SketchBattleView {
  if (!player.view) throw new Error(`${player.name} has no view`);
  return player.view;
}

/** Round 1 into the drawing stage; returns who draws and guesses on each team. */
async function toDrawing(game: Awaited<ReturnType<typeof playing>>) {
  const { code, people } = game;
  const chooser = people.find((p) => viewOf(p).chooserId === p.id);
  if (!chooser) throw new Error("No chooser");
  chooser.ws.send({ type: "move", move: { type: "choose", index: 0 } });
  await until(() => people.every((p) => p.view?.phase === "countdown"), "countdown");
  // The game's own 3 s countdown runs out on the room's real alarm.
  await until(() => people.every((p) => p.view?.phase === "drawing"), "drawing", 6_000);
  const byRole = (team: number, role: "drawer" | "guesser") => {
    const found = people.find((p) => viewOf(p).me.team === team && viewOf(p).me.role === role);
    if (!found) throw new Error(`No ${role} on team ${team}`);
    return found;
  };
  const word = (await storedState(code))?.round?.word ?? "";
  return {
    word,
    drawer: [byRole(0, "drawer"), byRole(1, "drawer")] as const,
    guesser: [byRole(0, "guesser"), byRole(1, "guesser")] as const,
  };
}

const draw = (stroke: number, points: number[], start = true) => ({
  type: "move",
  move: {
    type: "draw",
    stroke,
    points,
    ...(start ? { start: { tool: "pen", colour: 4, size: 2 } } : {}),
  },
});
const close = (people: Player[]) => people.forEach((p) => p.ws.ws.close(1000));

/** Each round waits out the game's real 3 s countdown. */
const SLOW = { timeout: 20_000 };

describe("Sketch Battle in a room", SLOW, () => {
  it("live draws reach teammates as points and opponents as pixel cells, and aren't saved", async () => {
    const game = await playing("sb-live");
    const { drawer, guesser } = await toDrawing(game);
    drawer[0].ws.send(draw(1, [100, 100, 50, 0, 50, 0]));
    drawer[0].ws.send(draw(1, [250, 100, 0, 60], false));
    await until(
      () =>
        viewOf(guesser[0]).teams[0].canvas.kind === "strokes" &&
        JSON.stringify(viewOf(guesser[0]).teams[0].canvas).includes("160"),
      "teammate sees points",
    );
    const mine = viewOf(guesser[0]).teams[0].canvas;
    expect(mine).toEqual({
      kind: "strokes",
      ops: [
        {
          id: 1,
          tool: "pen",
          colour: 4,
          size: 2,
          points: [100, 100, 150, 100, 200, 100, 250, 100, 250, 160],
        },
      ],
    });
    await until(
      () =>
        viewOf(guesser[1]).teams[0].canvas.kind === "cells" &&
        JSON.stringify(viewOf(guesser[1]).teams[0].canvas).includes("4"),
      "opponent sees cells",
    );

    const saved = await storedState(game.code);
    expect(saved?.round?.turns[0].ops).toEqual([]);
    close(game.people);
  });

  it("the other team's socket never carries the strokes or the word before they guess", async () => {
    const game = await playing("sb-wire");
    const { word, drawer, guesser } = await toDrawing(game);
    const watchers = game.people.filter(
      (p) => viewOf(p).me.team === 1 && viewOf(p).me.role === "guesser",
    );
    const from = watchers.map((p) => p.wire.length);
    drawer[0].ws.send(draw(1, [700, 400, 30, 30, 30, 30]));
    guesser[0].ws.send({ type: "move", move: { type: "guess", text: "not it" } });
    await settle();
    await settle();
    for (const [i, p] of watchers.entries()) {
      const seen = p.wire.slice(from[i]).join("\n");
      expect(seen).not.toContain('"points"');
      expect(seen).not.toContain(JSON.stringify(word));
      expect(seen).not.toContain("not it");
    }

    guesser[1].ws.send({ type: "move", move: { type: "guess", text: word } });
    await until(
      () => viewOf(guesser[1]).teams[0].canvas.kind === "strokes",
      "full drawing once guessed",
    );
    expect(viewOf(guesser[1]).word).toBe(word);
    close(game.people);
  });

  it("a correct guess is saved together with the live moves before it", async () => {
    const game = await playing("sb-save");
    const { word, drawer, guesser } = await toDrawing(game);
    drawer[0].ws.send(draw(1, [10, 10, 10, 10]));
    guesser[0].ws.send({ type: "move", move: { type: "guess", text: "nope" } });
    guesser[0].ws.send({ type: "move", move: { type: "guess", text: word } });
    await until(() => viewOf(guesser[0]).teams[0].solvedAt !== null, "solved");
    const saved = await storedState(game.code);
    expect(saved?.round?.turns[0].ops).toHaveLength(1);
    expect(saved?.round?.turns[0].guesses.map((g) => g.correct)).toEqual([false, true]);
    close(game.people);
  });

  it("drawers may send more moves than the platform's default 10, and a flood is still cut", async () => {
    const game = await playing("sb-limit");
    const { drawer, guesser } = await toDrawing(game);
    drawer[0].ws.send(draw(1, [10, 10]));
    for (let i = 0; i < 39; i++) drawer[0].ws.send(draw(1, [20 + i, 20], false));
    await settle();
    await settle();
    const canvas = viewOf(guesser[0]).teams[0].canvas;
    const first = canvas.kind === "strokes" ? canvas.ops[0] : undefined;
    const accepted = first && "points" in first ? first.points.length / 2 : 0;
    expect(accepted).toBeGreaterThanOrEqual(15);
    expect(accepted).toBeLessThan(40);
    close(game.people);
  });

  it("a resync sends the full view again", async () => {
    const game = await playing("sb-resync");
    const { guesser } = await toDrawing(game);
    const before = guesser[0].wire.length;
    guesser[0].ws.send({ type: "game.resync" });
    await until(() => guesser[0].wire.slice(before).some((m) => m.includes('"game.view"')), "view");
    close(game.people);
  });
});

describe("presence for Sketch Battle (D56)", SLOW, () => {
  it("a drop mid-game marks the player away, and a return clears it", async () => {
    const game = await playing("sb-away");
    const { asha, dev } = game;
    dev.ws.ws.close(1000);
    const devOn = (p: Player) =>
      viewOf(p)
        .teams.flatMap((t) => t.players)
        .find((x) => x.id === dev.id);
    await until(() => devOn(asha)?.away === true, "dev away");
    expect((await storedState(game.code))?.away).toEqual([dev.id]);

    await reconnect(game.code, dev);
    await until(() => devOn(asha)?.away === false, "dev back");
    expect(devOn(dev)?.away).toBe(false);
    close(game.people);
  });

  it("Play here never marks the player away", async () => {
    const game = await playing("sb-here");
    const { asha, ben } = game;
    const old = ben.ws;
    await reconnect(game.code, ben);
    await old.closed;
    await settle();
    expect((await storedState(game.code))?.away).toEqual([]);
    const benOn = viewOf(asha)
      .teams.flatMap((t) => t.players)
      .find((x) => x.id === ben.id);
    expect(benOn?.away).toBe(false);
    close(game.people);
  });
});
