export const PLAYER_COLOR_COUNT = 7;

/** A player's usual colour slot (0–6), the same everywhere. */
export function playerColor(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return hash % PLAYER_COLOR_COUNT;
}

/**
 * Colours for everyone in one room, in room order (longest there first): each person gets
 * their usual colour unless someone earlier has it, then the next free one. Nobody shares a
 * colour until the room has more people than colours.
 */
export function assignPlayerColors(ids: readonly string[]): Map<string, number> {
  const colors = new Map<string, number>();
  const used = new Set<number>();
  for (const id of ids) {
    if (colors.has(id)) continue;
    let slot = playerColor(id);
    if (used.size < PLAYER_COLOR_COUNT) {
      while (used.has(slot)) slot = (slot + 1) % PLAYER_COLOR_COUNT;
    }
    colors.set(id, slot);
    used.add(slot);
  }
  return colors;
}
