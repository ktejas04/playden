import { useEffect, useRef } from "react";
import type { CanvasOp } from "../types";
import { drawOps, opsUpTo, playbackCount, stepCount } from "./strokes";

/** True when `next` is `prev` with more drawn on the end, so new points can be played back. */
function grewFrom(prev: readonly CanvasOp[], next: readonly CanvasOp[]): boolean {
  if (next.length < prev.length) return false;
  for (let i = 0; i < prev.length - 1; i++) if (prev[i] !== next[i]) return false;
  const last = prev.at(-1);
  const same = next[prev.length - 1];
  if (!last || !same || last === same) return true;
  if ("clear" in last || "clear" in same) return false;
  return last.id === same.id && same.points.length >= last.points.length;
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Paints `ops` onto the canvas. Newly arrived points are spread over the next batch interval
 * (SB11), so a teammate's lines flow instead of jumping every 150 ms; anything else (a resync,
 * a whole drawing shown at once) appears at once. Off with reduced motion.
 */
export function usePlayback(
  canvas: React.RefObject<HTMLCanvasElement | null>,
  ops: readonly CanvasOp[],
  width: number,
  smooth: boolean,
): void {
  const shown = useRef({ ops: [] as readonly CanvasOp[], steps: 0, width: 0 });

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || width === 0) return;
    const paint = (steps: number) => {
      ctx.clearRect(0, 0, width, (width * 2) / 3);
      drawOps(ctx, opsUpTo(ops, steps), width);
    };
    const target = stepCount(ops);
    const before = shown.current;
    const animate =
      smooth && before.width === width && grewFrom(before.ops, ops) && !prefersReducedMotion();
    const from = animate ? Math.min(before.steps, target) : target;
    shown.current = { ops, steps: target, width };
    if (from === target) {
      paint(target);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const step = () => {
      const count = playbackCount(from, target, performance.now() - started);
      paint(count);
      if (count < target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [canvas, ops, width, smooth]);
}
