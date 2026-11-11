import type { AnyGame } from "@playden/engine";
import { tapRace } from "@playden/game-tap-race";

/**
 * Every game the server can run (rules only, never screens). Adding a game: `pnpm new-game`
 * adds its line here and in apps/web/src/games.ts. Removing one: delete its folder and both
 * lines; the architecture checks catch anything left behind.
 */
export const GAMES: readonly AnyGame[] = [tapRace];

export function findGame(id: string): AnyGame | undefined {
  return GAMES.find((game) => game.id === id);
}

/** Games a room may offer; dev-only games appear only on local dev servers. */
export function listGames({ includeDevOnly }: { includeDevOnly: boolean }): AnyGame[] {
  return GAMES.filter((game) => includeDevOnly || !game.devOnly);
}
