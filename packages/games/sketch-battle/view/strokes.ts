import {
  BRUSH_SIZES,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MIN_POINT_DISTANCE,
  STROKE_BATCH_MS,
} from "../config";
import type { BrushSize, CanvasOp, DrawStart, SketchBattleMove, Stroke } from "../types";
import { PALETTE, PAPER } from "./palette";

/** A point in canvas units: x 0–1500, y 0–1000. */
export type Point = [number, number];
type DrawMove = Extract<SketchBattleMove, { type: "draw" }>;

const clamp = (v: number, max: number) => Math.min(Math.max(Math.round(v), 0), max);

/** A pointer position on the screen to whole canvas units, clipped to the canvas. */
export function toCanvasPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): Point {
  return [
    clamp(((clientX - rect.left) / rect.width) * CANVAS_WIDTH, CANVAS_WIDTH),
    clamp(((clientY - rect.top) / rect.height) * CANVAS_HEIGHT, CANVAS_HEIGHT),
  ];
}

/** Points closer than MIN_POINT_DISTANCE to the last one add nothing worth sending. */
export function farEnough(last: Point | null, next: Point): boolean {
  if (!last) return true;
  return Math.hypot(next[0] - last[0], next[1] - last[1]) >= MIN_POINT_DISTANCE;
}

/** A batch's points: the first absolute, the rest as differences from the point before. */
export function encodeBatch(points: readonly number[]): number[] {
  return points.map((v, i) => (i < 2 ? v : v - (points[i - 2] ?? 0)));
}

export function decodeBatch(encoded: readonly number[]): number[] {
  const out: number[] = [];
  encoded.forEach((v, i) => out.push(i < 2 ? v : v + (out[i - 2] ?? 0)));
  return out;
}

/**
 * The drawer's outgoing stroke (SB11): pen-down goes at once, then points are held and sent
 * at most every STROKE_BATCH_MS, and pen-up goes at once with whatever is left.
 */
export interface Sender {
  stroke: number;
  active: boolean;
  last: Point | null;
  pending: number[];
  lastSentAt: number;
}

export const IDLE_SENDER: Sender = {
  stroke: 0,
  active: false,
  last: null,
  pending: [],
  lastSentAt: 0,
};

const batch = (sender: Sender, extra: Partial<DrawMove> = {}): DrawMove => ({
  type: "draw",
  stroke: sender.stroke,
  points: encodeBatch(sender.pending),
  ...extra,
});

export function penDown(
  stroke: number,
  start: DrawStart,
  point: Point,
  now: number,
): { sender: Sender; move: DrawMove } {
  const sender: Sender = { stroke, active: true, last: point, pending: [], lastSentAt: now };
  return { sender, move: { type: "draw", stroke, start, points: [...point] } };
}

export function penMove(
  sender: Sender,
  point: Point,
  now: number,
): { sender: Sender; move: DrawMove | null } {
  if (!sender.active || !farEnough(sender.last, point)) return { sender, move: null };
  return flushDue({ ...sender, last: point, pending: [...sender.pending, ...point] }, now);
}

/** Sends held points once STROKE_BATCH_MS has passed since the last send. */
export function flushDue(sender: Sender, now: number): { sender: Sender; move: DrawMove | null } {
  if (!sender.active || sender.pending.length === 0 || now - sender.lastSentAt < STROKE_BATCH_MS) {
    return { sender, move: null };
  }
  return { sender: { ...sender, pending: [], lastSentAt: now }, move: batch(sender) };
}

export function penUp(
  sender: Sender,
  point: Point | null,
  now: number,
): { sender: Sender; move: DrawMove | null } {
  if (!sender.active) return { sender, move: null };
  const withLast =
    point && farEnough(sender.last, point)
      ? { ...sender, pending: [...sender.pending, ...point] }
      : sender;
  const done: Sender = { ...withLast, active: false, pending: [], lastSentAt: now };
  if (withLast.pending.length === 0) return { sender: done, move: null };
  return { sender: done, move: batch(withLast, { end: true }) };
}

/** Line width in pixels for a brush size on a canvas this many pixels wide. */
export function brushWidth(size: BrushSize, canvasWidth: number): number {
  return (BRUSH_SIZES[size - 1] ?? BRUSH_SIZES[0]) * canvasWidth;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, scale: number, width: number) {
  const colour = stroke.tool === "eraser" ? PAPER : (PALETTE[stroke.colour] ?? PALETTE[0]);
  const lineWidth = brushWidth(stroke.size, width);
  const { points } = stroke;
  if (points.length < 2) return;
  if (points.length === 2) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.arc((points[0] ?? 0) * scale, (points[1] ?? 0) * scale, lineWidth / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = colour;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo((points[0] ?? 0) * scale, (points[1] ?? 0) * scale);
  for (let i = 2; i + 1 < points.length; i += 2) {
    ctx.lineTo((points[i] ?? 0) * scale, (points[i + 1] ?? 0) * scale);
  }
  ctx.stroke();
}

/** Paints canvas operations onto a canvas `width` pixels wide (3:2), in order. */
export function drawOps(ctx: CanvasRenderingContext2D, ops: readonly CanvasOp[], width: number) {
  const scale = width / CANVAS_WIDTH;
  for (const op of ops) {
    if ("clear" in op) {
      ctx.fillStyle = PAPER;
      ctx.fillRect(0, 0, width, (width * CANVAS_HEIGHT) / CANVAS_WIDTH);
    } else {
      drawStroke(ctx, op, scale, width);
    }
  }
}

/** How many of the points between `from` and `to` to show `elapsed` ms after they arrived. */
export function playbackCount(from: number, to: number, elapsed: number): number {
  const share = Math.min(1, Math.max(0, elapsed / STROKE_BATCH_MS));
  return from + Math.round((to - from) * share);
}

/** Total steps in a drawing: one per point, one per clear. */
export function stepCount(ops: readonly CanvasOp[]): number {
  return ops.reduce((sum, op) => sum + ("clear" in op ? 1 : op.points.length / 2), 0);
}

/** The drawing as it was after `steps` steps (a point or a clear each), for playback and replays. */
export function opsUpTo(ops: readonly CanvasOp[], steps: number): CanvasOp[] {
  const out: CanvasOp[] = [];
  let left = steps;
  for (const op of ops) {
    if (left <= 0) break;
    if ("clear" in op) {
      out.push(op);
      left -= 1;
      continue;
    }
    const count = op.points.length / 2;
    out.push(count <= left ? op : { ...op, points: op.points.slice(0, left * 2) });
    left -= count;
  }
  return out;
}
