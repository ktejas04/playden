import { CANVAS_HEIGHT, CANVAS_WIDTH, PREVIEW_COLS, PREVIEW_ROWS } from "./config";
import type { CanvasOp, Stroke } from "./types";

/**
 * The other team's pixel view (SB6, D47): a 24 × 16 grid built on the server from strokes it
 * never sends them. One character per cell, row by row: "." empty, "0"–"9" a palette colour.
 * Every stroke segment marks each cell it passes through, 1 cell wide whatever the brush.
 */
export const EMPTY_CELLS = ".".repeat(PREVIEW_COLS * PREVIEW_ROWS);

const CELL_WIDTH = CANVAS_WIDTH / PREVIEW_COLS;
const CELL_HEIGHT = CANVAS_HEIGHT / PREVIEW_ROWS;
/** Just inside the last column or row, so the far edge of the canvas stays on the grid. */
const EDGE = 1e-9;

function toGrid(x: number, y: number): [number, number] {
  return [
    Math.min(Math.max(x / CELL_WIDTH, 0), PREVIEW_COLS - EDGE),
    Math.min(Math.max(y / CELL_HEIGHT, 0), PREVIEW_ROWS - EDGE),
  ];
}

/**
 * Every cell a segment passes through, in order (a grid walk after Amanatides and Woo, "A Fast
 * Voxel Traversal Algorithm", 1987), in grid units.
 */
function cellsOnSegment(x0: number, y0: number, x1: number, y1: number): number[] {
  let col = Math.floor(x0);
  let row = Math.floor(y0);
  const endCol = Math.floor(x1);
  const endRow = Math.floor(y1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const stepCol = Math.sign(dx);
  const stepRow = Math.sign(dy);
  const tDeltaX = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tDeltaY = dy === 0 ? Infinity : Math.abs(1 / dy);
  let tMaxX = dx === 0 ? Infinity : (stepCol > 0 ? col + 1 - x0 : x0 - col) * tDeltaX;
  let tMaxY = dy === 0 ? Infinity : (stepRow > 0 ? row + 1 - y0 : y0 - row) * tDeltaY;
  const cells = [row * PREVIEW_COLS + col];
  while (col !== endCol || row !== endRow) {
    if (tMaxX < tMaxY) {
      col += stepCol;
      tMaxX += tDeltaX;
    } else {
      row += stepRow;
      tMaxY += tDeltaY;
    }
    if (col < 0 || row < 0 || col >= PREVIEW_COLS || row >= PREVIEW_ROWS) break;
    cells.push(row * PREVIEW_COLS + col);
  }
  return cells;
}

/**
 * Marks a stroke's segments from point `from` (a point index) on; with `from` > 0 the segment
 * from the point before is included, so a stroke drawn in batches marks the same cells.
 */
export function markStroke(cells: string, stroke: Stroke, from = 0): string {
  const mark = stroke.tool === "eraser" ? "." : String(stroke.colour);
  const grid = cells.split("");
  const count = stroke.points.length / 2;
  const point = (i: number) => toGrid(stroke.points[i * 2] ?? 0, stroke.points[i * 2 + 1] ?? 0);
  if (count === 1 && from === 0) {
    const [x, y] = point(0);
    grid[Math.floor(y) * PREVIEW_COLS + Math.floor(x)] = mark;
  }
  for (let i = Math.max(1, from); i < count; i++) {
    const [x0, y0] = point(i - 1);
    const [x1, y1] = point(i);
    for (const cell of cellsOnSegment(x0, y0, x1, y1)) grid[cell] = mark;
  }
  const next = grid.join("");
  return next === cells ? cells : next;
}

/** The cells after one whole canvas operation. */
export function cellsAfter(cells: string, op: CanvasOp): string {
  return "clear" in op ? EMPTY_CELLS : markStroke(cells, op);
}

/** The cells that differ between two grids, as [index, new character]. */
export function changedCells(before: string, after: string): [number, string][] {
  const changes: [number, string][] = [];
  for (let i = 0; i < after.length; i++) {
    if (before[i] !== after[i]) changes.push([i, after[i] ?? "."]);
  }
  return changes;
}
