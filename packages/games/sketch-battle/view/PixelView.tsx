import { cn } from "@playden/ui/lib/utils";
import { useEffect, useRef } from "react";
import { PREVIEW_COLS, PREVIEW_ROWS } from "../config";
import { PALETTE, PAPER } from "./palette";

/**
 * The other team's drawing as the server lets us see it before we guess (D47): 24 × 16
 * coloured cells, drawn as crisp blocks.
 */
export function PixelView({ cells, className }: { cells: string; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, PREVIEW_COLS, PREVIEW_ROWS);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell === "." || cell === undefined) continue;
      ctx.fillStyle = PALETTE[Number(cell)] ?? PALETTE[0];
      ctx.fillRect(i % PREVIEW_COLS, Math.floor(i / PREVIEW_COLS), 1, 1);
    }
  }, [cells]);
  return (
    <canvas
      ref={canvas}
      width={PREVIEW_COLS}
      height={PREVIEW_ROWS}
      role="img"
      aria-label="The other team's drawing, as blocks"
      className={cn("aspect-[3/2] w-full rounded-lg border [image-rendering:pixelated]", className)}
    />
  );
}
