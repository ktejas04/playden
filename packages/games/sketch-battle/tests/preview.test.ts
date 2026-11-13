import { describe, expect, it } from "vitest";
import { PREVIEW_COLS, PREVIEW_ROWS } from "../config";
import { EMPTY_CELLS, cellsAfter, changedCells, markStroke } from "../preview";
import type { Stroke } from "../types";

/** Canvas units per cell: 1500 / 24 = 62.5 across, 1000 / 16 = 62.5 down. */
const CELL = 62.5;
const at = (col: number, row: number) => row * PREVIEW_COLS + col;
const filled = (cells: string) =>
  [...cells].flatMap((c, i) =>
    c === "." ? [] : [[i % PREVIEW_COLS, Math.floor(i / PREVIEW_COLS)]],
  );
const stroke = (points: number[], fields: Partial<Stroke> = {}): Stroke => ({
  id: 1,
  tool: "pen",
  colour: 3,
  size: 1,
  points,
  ...fields,
});

describe("the opponent pixel view (024, D47)", () => {
  it("starts empty: 24 × 16 cells", () => {
    expect(EMPTY_CELLS).toHaveLength(PREVIEW_COLS * PREVIEW_ROWS);
    expect(filled(EMPTY_CELLS)).toEqual([]);
  });

  it("a horizontal line fills one row of cells", () => {
    const y = 5 * CELL + 10;
    const cells = markStroke(EMPTY_CELLS, stroke([0, y, 1499, y]));
    expect(filled(cells)).toEqual(Array.from({ length: PREVIEW_COLS }, (_, col) => [col, 5]));
  });

  it("a diagonal line fills the cells it crosses", () => {
    const cells = markStroke(EMPTY_CELLS, stroke([10, 10, 4 * CELL - 10, 4 * CELL - 10]));
    const got = filled(cells);
    for (const step of [0, 1, 2, 3]) expect(got).toContainEqual([step, step]);
    // A line from corner to corner of 4 cells crosses no cell far off its path.
    expect(got.every(([c, r]) => Math.abs((c ?? 0) - (r ?? 0)) <= 1)).toBe(true);
  });

  it("a thick brush still marks 1 cell wide", () => {
    const y = 8 * CELL + 30;
    const thin = markStroke(EMPTY_CELLS, stroke([100, y, 900, y]));
    const thick = markStroke(EMPTY_CELLS, stroke([100, y, 900, y], { size: 4 }));
    expect(thick).toBe(thin);
  });

  it("a single dot marks its cell", () => {
    expect(filled(markStroke(EMPTY_CELLS, stroke([CELL * 2 + 1, CELL * 3 + 1])))).toEqual([[2, 3]]);
  });

  it("the eraser and clear empty cells, and the last colour wins in a cell", () => {
    const y = 2 * CELL + 5;
    let cells = markStroke(EMPTY_CELLS, stroke([0, y, 3 * CELL, y], { colour: 1 }));
    cells = markStroke(cells, stroke([CELL + 5, 0, CELL + 5, 3 * CELL], { colour: 7 }));
    expect(cells[at(1, 2)]).toBe("7");
    expect(cells[at(0, 2)]).toBe("1");

    cells = markStroke(cells, stroke([0, y, CELL / 2, y], { tool: "eraser" }));
    expect(cells[at(0, 2)]).toBe(".");
    expect(cellsAfter(cells, { clear: true })).toBe(EMPTY_CELLS);
  });

  it("lists only the cells that changed", () => {
    const before = EMPTY_CELLS;
    const after = markStroke(before, stroke([1, 1]));
    expect(changedCells(before, after)).toEqual([[0, "3"]]);
  });

  it("points outside the canvas are clipped to its edge cells", () => {
    expect(filled(markStroke(EMPTY_CELLS, stroke([1500, 1000])))).toEqual([
      [PREVIEW_COLS - 1, PREVIEW_ROWS - 1],
    ]);
  });
});
