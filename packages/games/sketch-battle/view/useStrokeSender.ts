import { useCallback, useEffect, useRef } from "react";
import { STROKE_BATCH_MS } from "../config";
import type { DrawStart, SketchBattleMove } from "../types";
import { IDLE_SENDER, type Point, type Sender, flushDue, penDown, penMove, penUp } from "./strokes";

/**
 * The drawer's side of SB11: pen-down and pen-up go at once, moves in between at most every
 * STROKE_BATCH_MS, and a timer sends held points when the pen pauses.
 */
export function useStrokeSender(sendMove: (move: SketchBattleMove) => void, now: () => number) {
  const sender = useRef<Sender>(IDLE_SENDER);

  useEffect(() => {
    const timer = setInterval(() => {
      const { sender: next, move } = flushDue(sender.current, now());
      sender.current = next;
      if (move) sendMove(move);
    }, STROKE_BATCH_MS / 3);
    return () => clearInterval(timer);
  }, [sendMove, now]);

  const down = useCallback(
    (stroke: number, start: DrawStart, point: Point) => {
      const { sender: next, move } = penDown(stroke, start, point, now());
      sender.current = next;
      sendMove(move);
    },
    [sendMove, now],
  );

  const move = useCallback(
    (point: Point) => {
      const { sender: next, move: batch } = penMove(sender.current, point, now());
      sender.current = next;
      if (batch) sendMove(batch);
    },
    [sendMove, now],
  );

  const up = useCallback(
    (point: Point | null) => {
      const { sender: next, move: batch } = penUp(sender.current, point, now());
      sender.current = next;
      if (batch) sendMove(batch);
    },
    [sendMove, now],
  );

  return { down, move, up };
}
