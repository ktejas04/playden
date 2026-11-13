/**
 * Sketch Battle's own shades (SB7): black, light grey, pink, red, orange, yellow, green, blue,
 * purple, brown. The canvas is warm paper in both themes, so a drawing looks the same on every
 * screen; every shade reads on it, and on the felt of the dark theme around it.
 */
export const PALETTE = [
  "#22201c",
  "#b9b6ae",
  "#f286b4",
  "#e0493c",
  "#f28a2e",
  "#f2c230",
  "#3c9c5a",
  "#2f7ed6",
  "#8a5bc8",
  "#8b5a3a",
] as const;

export const PALETTE_NAMES = [
  "Black",
  "Light grey",
  "Pink",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Brown",
] as const;

/** The canvas background, and the eraser's colour. */
export const PAPER = "#fffcf3";

/** Team accents: coral and teal, the first two player colours (D34). */
export const TEAM_ACCENT = ["var(--player-1)", "var(--player-2)"] as const;
export const TEAM_NAME = ["Team 1", "Team 2"] as const;
