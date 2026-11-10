export const PLAYER_COLOR_COUNT = 5;

/** Stable colour slot (0–4) per player, so someone keeps the same colour everywhere. */
export function playerColor(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash % PLAYER_COLOR_COUNT;
}
