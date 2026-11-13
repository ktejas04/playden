import { changedCells } from "./preview";
import type {
  CanvasDelta,
  CanvasOp,
  CanvasView,
  Guess,
  SketchBattleDelta,
  SketchBattleView,
  TeamDelta,
  TeamView,
} from "./types";

/**
 * What changed in one viewer's view (D55), so a draw batch sends a few points (or a few
 * pixel cells) instead of the whole drawing. Built from two views the viewer may see, so it
 * can never carry more than `view` would. `applyDelta(before, viewDelta(before, after))`
 * equals `after`; the contract kit checks it on every change.
 */
const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

function isStroke(op: CanvasOp | undefined): op is Extract<CanvasOp, { id: number }> {
  return op !== undefined && "id" in op;
}

/** True when `after` is `before` with more points on the end. */
function extends_(before: CanvasOp, after: CanvasOp): boolean {
  if (!isStroke(before) || !isStroke(after)) return false;
  if (before.id !== after.id || before.tool !== after.tool) return false;
  if (before.colour !== after.colour || before.size !== after.size) return false;
  if (after.points.length < before.points.length) return false;
  return before.points.every((value, i) => after.points[i] === value);
}

function canvasDelta(before: CanvasView, after: CanvasView): CanvasDelta | null {
  if (before.kind === "cells" && after.kind === "cells") {
    const cells = changedCells(before.cells, after.cells);
    return cells.length === 0 ? null : { cells };
  }
  if (before.kind !== "strokes" || after.kind !== "strokes") return { replace: after };
  const was = before.ops;
  const now = after.ops;
  if (was === now) return null;
  if (now.length < was.length) return { replace: after };
  const lastIndex = was.length - 1;
  for (let i = 0; i < lastIndex; i++) if (!same(was[i], now[i])) return { replace: after };
  const delta: { extend?: number[]; add?: CanvasOp[] } = {};
  const lastBefore = was[lastIndex];
  const lastAfter = now[lastIndex];
  if (lastBefore !== undefined && lastAfter !== undefined && !same(lastBefore, lastAfter)) {
    if (!extends_(lastBefore, lastAfter) || !isStroke(lastBefore) || !isStroke(lastAfter)) {
      return { replace: after };
    }
    delta.extend = lastAfter.points.slice(lastBefore.points.length);
  }
  if (now.length > was.length) delta.add = now.slice(was.length);
  return delta.extend || delta.add ? delta : null;
}

function guessesDelta(before: Guess[] | null, after: Guess[] | null): TeamDelta["guesses"] | null {
  if (before === after) return null;
  if (before === null || after === null || after.length < before.length) return { replace: after };
  for (let i = 0; i < before.length; i++) {
    if (!same(before[i], after[i])) return { replace: after };
  }
  return after.length === before.length ? null : { add: after.slice(before.length) };
}

function teamDelta(before: TeamView, after: TeamView): TeamDelta | null {
  const delta: TeamDelta = {};
  const set: NonNullable<TeamDelta["set"]> = {};
  for (const key of ["players", "score", "drawerId", "drawFrom", "solvedAt"] as const) {
    if (!same(before[key], after[key])) Object.assign(set, { [key]: after[key] });
  }
  if (Object.keys(set).length > 0) delta.set = set;
  const canvas = canvasDelta(before.canvas, after.canvas);
  if (canvas) delta.canvas = canvas;
  const guesses = guessesDelta(before.guesses, after.guesses);
  if (guesses) delta.guesses = guesses;
  return Object.keys(delta).length === 0 ? null : delta;
}

export function viewDelta(
  before: SketchBattleView,
  after: SketchBattleView,
): SketchBattleDelta | null {
  const delta: SketchBattleDelta = {};
  const set: NonNullable<SketchBattleDelta["set"]> = {};
  for (const key of Object.keys(after) as (keyof SketchBattleView)[]) {
    if (key !== "teams" && !same(before[key], after[key])) {
      Object.assign(set, { [key]: after[key] });
    }
  }
  if (Object.keys(set).length > 0) delta.set = set;
  const teams = [
    teamDelta(before.teams[0], after.teams[0]),
    teamDelta(before.teams[1], after.teams[1]),
  ];
  if (teams[0] || teams[1]) delta.teams = [teams[0] ?? null, teams[1] ?? null];
  return Object.keys(delta).length === 0 ? null : delta;
}

function applyCanvas(canvas: CanvasView, delta: CanvasDelta): CanvasView {
  if ("replace" in delta) return delta.replace;
  if ("cells" in delta) {
    if (canvas.kind !== "cells") return canvas;
    const cells = canvas.cells.split("");
    for (const [index, value] of delta.cells) cells[index] = value;
    return { kind: "cells", cells: cells.join("") };
  }
  if (canvas.kind !== "strokes") return canvas;
  let ops = canvas.ops;
  const last = ops.at(-1);
  if (delta.extend && isStroke(last)) {
    ops = [...ops.slice(0, -1), { ...last, points: [...last.points, ...delta.extend] }];
  }
  if (delta.add) ops = [...ops, ...delta.add];
  return { kind: "strokes", ops };
}

function applyTeam(team: TeamView, delta: TeamDelta | null): TeamView {
  if (!delta) return team;
  let next: TeamView = delta.set ? { ...team, ...delta.set } : team;
  if (delta.canvas) next = { ...next, canvas: applyCanvas(next.canvas, delta.canvas) };
  if (delta.guesses) {
    const guesses =
      "replace" in delta.guesses
        ? delta.guesses.replace
        : [...(next.guesses ?? []), ...delta.guesses.add];
    next = { ...next, guesses };
  }
  return next;
}

export function applyViewDelta(view: SketchBattleView, delta: SketchBattleDelta): SketchBattleView {
  const next = delta.set ? { ...view, ...delta.set } : { ...view };
  if (delta.teams) {
    next.teams = [
      applyTeam(view.teams[0], delta.teams[0]),
      applyTeam(view.teams[1], delta.teams[1]),
    ];
  }
  return next;
}
