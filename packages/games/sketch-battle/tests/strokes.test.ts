import { describe, expect, it } from "vitest";
import { STROKE_BATCH_MS } from "../config";
import { PALETTE, PAPER } from "../view/palette";
import {
  brushWidth,
  decodeBatch,
  drawOps,
  encodeBatch,
  farEnough,
  flushDue,
  opsUpTo,
  penDown,
  penMove,
  penUp,
  playbackCount,
  toCanvasPoint,
} from "../view/strokes";

const rect = { left: 10, top: 20, width: 300, height: 200 };
const start = { tool: "pen", colour: 0, size: 1 } as const;

describe("canvas coordinates (023)", () => {
  it("maps a pointer to whole canvas units, 0–1500 by 0–1000, whatever the screen size", () => {
    expect(toCanvasPoint(10, 20, rect)).toEqual([0, 0]);
    expect(toCanvasPoint(160, 120, rect)).toEqual([750, 500]);
    expect(toCanvasPoint(310, 220, rect)).toEqual([1500, 1000]);
    expect(toCanvasPoint(85.1, 70, { ...rect, width: 600, height: 400 })).toEqual([188, 125]);
  });

  it("clips pointers outside the canvas to its edge", () => {
    expect(toCanvasPoint(-50, 999, rect)).toEqual([0, 1000]);
  });

  it("drops points closer than 4 units to the last one", () => {
    expect(farEnough([100, 100], [103, 102])).toBe(false);
    expect(farEnough([100, 100], [104, 100])).toBe(true);
    expect(farEnough(null, [0, 0])).toBe(true);
  });
});

describe("delta encoding", () => {
  it("keeps the first point absolute and the rest as differences, and decodes back", () => {
    const points = [100, 100, 110, 95, 130, 95];
    expect(encodeBatch(points)).toEqual([100, 100, 10, -5, 20, 0]);
    expect(decodeBatch(encodeBatch(points))).toEqual(points);
  });
});

describe("sending a stroke in batches (SB11)", () => {
  it("sends the pen-down point at once, with the tool", () => {
    const { move } = penDown(1, start, [100, 100], 0);
    expect(move).toEqual({ type: "draw", stroke: 1, start, points: [100, 100] });
  });

  it("holds points until 150 ms since the last send, then sends them as one batch", () => {
    let { sender } = penDown(1, start, [100, 100], 0);
    let step = penMove(sender, [120, 100], 50);
    expect(step.move).toBeNull();
    step = penMove(step.sender, [140, 110], 100);
    expect(step.move).toBeNull();
    step = penMove(step.sender, [160, 110], STROKE_BATCH_MS);
    expect(step.move).toEqual({ type: "draw", stroke: 1, points: [120, 100, 20, 10, 20, 0] });
    sender = step.sender;
    expect(penMove(sender, [180, 110], STROKE_BATCH_MS + 10).move).toBeNull();
  });

  it("a timer flushes held points even when the pen stops moving", () => {
    const down = penDown(1, start, [100, 100], 0);
    const held = penMove(down.sender, [120, 100], 20);
    expect(flushDue(held.sender, 100).move).toBeNull();
    expect(flushDue(held.sender, STROKE_BATCH_MS).move).toEqual({
      type: "draw",
      stroke: 1,
      points: [120, 100],
    });
  });

  it("sends the pen-up at once with the remaining points", () => {
    const down = penDown(1, start, [100, 100], 0);
    const held = penMove(down.sender, [120, 100], 20);
    const up = penUp(held.sender, [140, 100], 30);
    expect(up.move).toEqual({ type: "draw", stroke: 1, points: [120, 100, 20, 0], end: true });
    expect(up.sender.active).toBe(false);
  });

  it("skips points too close to the last one", () => {
    const down = penDown(1, start, [100, 100], 0);
    const held = penMove(down.sender, [102, 101], 200);
    expect(held.move).toBeNull();
    expect(penUp(held.sender, null, 210).move).toBeNull();
  });
});

describe("drawing on a canvas", () => {
  function recorder() {
    const calls: string[] = [];
    const ctx = {
      set fillStyle(v: string) {
        calls.push(`fill=${v}`);
      },
      set strokeStyle(v: string) {
        calls.push(`stroke=${v}`);
      },
      set lineWidth(v: number) {
        calls.push(`width=${v}`);
      },
      lineCap: "",
      lineJoin: "",
      fillRect: (x: number, y: number, w: number, h: number) =>
        calls.push(`rect ${x},${y},${w},${h}`),
      beginPath: () => calls.push("begin"),
      moveTo: (x: number, y: number) => calls.push(`move ${x},${y}`),
      lineTo: (x: number, y: number) => calls.push(`line ${x},${y}`),
      arc: (x: number, y: number) => calls.push(`dot ${x},${y}`),
      fill: () => calls.push("fill"),
      stroke: () => calls.push("stroke"),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
  }

  it("scales stroke width with the canvas: sizes are fractions of its width", () => {
    expect(brushWidth(1, 300)).toBe(3);
    expect(brushWidth(4, 300)).toBe(30);
    expect(brushWidth(2, 1500)).toBe(30);
  });

  it("draws a pen line in its colour, scaled to the canvas", () => {
    const { ctx, calls } = recorder();
    drawOps(ctx, [{ id: 1, tool: "pen", colour: 3, size: 1, points: [0, 0, 1500, 1000] }], 300);
    expect(calls).toContain(`stroke=${PALETTE[3]}`);
    expect(calls).toContain("move 0,0");
    expect(calls).toContain("line 300,200");
  });

  it("the eraser paints the paper colour and clear wipes the canvas", () => {
    const { ctx, calls } = recorder();
    drawOps(
      ctx,
      [{ id: 1, tool: "eraser", colour: 3, size: 2, points: [10, 10, 20, 20] }, { clear: true }],
      300,
    );
    expect(calls).toContain(`stroke=${PAPER}`);
    expect(calls).toContain(`fill=${PAPER}`);
    expect(calls).toContain("rect 0,0,300,200");
  });

  it("a single point draws a dot", () => {
    const { ctx, calls } = recorder();
    drawOps(ctx, [{ id: 1, tool: "pen", colour: 0, size: 1, points: [750, 500] }], 300);
    expect(calls).toContain("dot 150,100");
  });
});

describe("playback and replay", () => {
  it("spreads newly arrived points over 150 ms instead of jumping", () => {
    expect(playbackCount(10, 20, 0)).toBe(10);
    expect(playbackCount(10, 20, 75)).toBe(15);
    expect(playbackCount(10, 20, 150)).toBe(20);
    expect(playbackCount(10, 20, 500)).toBe(20);
  });

  it("replays a drawing step by step, a point at a time", () => {
    const ops = [
      { id: 1, tool: "pen" as const, colour: 0, size: 1 as const, points: [0, 0, 10, 10, 20, 20] },
      { clear: true as const },
      { id: 2, tool: "pen" as const, colour: 1, size: 1 as const, points: [5, 5] },
    ];
    expect(opsUpTo(ops, 2)).toEqual([{ ...ops[0], points: [0, 0, 10, 10] }]);
    expect(opsUpTo(ops, 4)).toEqual([ops[0], ops[1]]);
    expect(opsUpTo(ops, 99)).toEqual(ops);
  });
});
