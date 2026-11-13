import { cn } from "@playden/ui/lib/utils";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import type { CanvasOp, DrawStart, SketchBattleMove, Stroke } from "../types";
import { PAPER } from "./palette";
import { type Point, drawOps, farEnough, toCanvasPoint } from "./strokes";
import { usePlayback } from "./usePlayback";
import { useStrokeSender } from "./useStrokeSender";

/** Canvas pixels at the screen's density, so lines stay sharp on phones. */
function useCanvasSize(box: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry?.contentRect.width ?? 0));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [box]);
  return width;
}

function prepare(canvas: HTMLCanvasElement | null, width: number) {
  if (!canvas || width === 0) return;
  const ratio = window.devicePixelRatio || 1;
  const height = (width * 2) / 3;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

export interface DrawingTools {
  start: DrawStart;
  sendMove: (move: SketchBattleMove) => void;
  serverNow: () => number;
}

/**
 * A 3:2 drawing surface. Shows `ops` (smoothly, as they arrive). With `tools` the viewer is the
 * drawer: their own line shows at once on a layer above, and leaves it once the server's copy
 * has caught up, so nothing waits for the round trip.
 */
export function Canvas({
  ops,
  tools,
  smooth = true,
  className,
  children,
  label,
  accent,
}: {
  ops: readonly CanvasOp[];
  /** The border colour, e.g. the team's colour. */
  accent?: string;
  tools?: DrawingTools | null;
  smooth?: boolean;
  className?: string;
  children?: ReactNode;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const width = useCanvasSize(box);
  /** The drawer's own line, shown at once; `ended` once the pen is up. */
  const local = useRef<{ stroke: Stroke; ended: boolean } | null>(null);
  const latestOps = useRef(ops);
  const nextId = useRef(1);
  const noSend = useCallback(() => undefined, []);
  const noNow = useCallback(() => 0, []);
  const sender = useStrokeSender(tools?.sendMove ?? noSend, tools?.serverNow ?? noNow);

  useEffect(() => {
    prepare(base.current, width);
    prepare(overlay.current, width);
  }, [width]);

  usePlayback(base, ops, width, smooth && !tools);

  const paintLocal = useCallback(() => {
    const ctx = overlay.current?.getContext("2d");
    if (!ctx || width === 0) return;
    ctx.clearRect(0, 0, width, (width * 2) / 3);
    if (local.current) drawOps(ctx, [local.current.stroke], width);
  }, [width]);

  /** Once the pen is up and the server's copy has every point, the overlay lets go of the line. */
  const releaseIfCaughtUp = useCallback(() => {
    const mine = local.current;
    if (!mine?.ended) return;
    const copy = latestOps.current.find(
      (op): op is Stroke => "id" in op && op.id === mine.stroke.id,
    );
    if (copy && copy.points.length >= mine.stroke.points.length) {
      local.current = null;
      paintLocal();
    }
  }, [paintLocal]);

  useEffect(() => {
    latestOps.current = ops;
    let highest = 0;
    for (const op of ops) if ("id" in op) highest = Math.max(highest, op.id);
    nextId.current = Math.max(nextId.current, highest + 1);
    releaseIfCaughtUp();
  }, [ops, releaseIfCaughtUp]);

  const pointFrom = (event: React.PointerEvent): Point =>
    toCanvasPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!tools || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFrom(event);
    const id = nextId.current++;
    local.current = { stroke: { id, ...tools.start, points: [...point] }, ended: false };
    sender.down(id, tools.start, point);
    paintLocal();
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const mine = local.current?.ended === false ? local.current.stroke : null;
    if (!tools || !mine || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    for (const sample of event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent]) {
      const point = toCanvasPoint(
        sample.clientX,
        sample.clientY,
        event.currentTarget.getBoundingClientRect(),
      );
      const last: Point = [mine.points.at(-2) ?? 0, mine.points.at(-1) ?? 0];
      if (!farEnough(last, point)) continue;
      mine.points = [...mine.points, ...point];
      sender.move(point);
    }
    paintLocal();
  };

  const onPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const mine = local.current;
    if (!tools || !mine || mine.ended) return;
    const point = pointFrom(event);
    const last: Point = [mine.stroke.points.at(-2) ?? 0, mine.stroke.points.at(-1) ?? 0];
    if (farEnough(last, point)) mine.stroke.points = [...mine.stroke.points, ...point];
    mine.ended = true;
    sender.up(point);
    paintLocal();
    releaseIfCaughtUp();
  };

  return (
    <div
      ref={box}
      className={cn(
        "relative aspect-[3/2] w-full overflow-hidden rounded-xl border-2 shadow-[0_2px_0_0_var(--border)]",
        className,
      )}
      style={{ background: PAPER, borderColor: accent }}
    >
      <canvas ref={base} aria-label={label} role="img" className="absolute inset-0 size-full" />
      <canvas
        ref={overlay}
        aria-hidden
        className={cn("absolute inset-0 size-full", tools && "cursor-crosshair touch-none")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {children}
    </div>
  );
}
