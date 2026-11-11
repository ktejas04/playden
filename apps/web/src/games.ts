import type { AnyGame, GameDefinition, GameViewProps } from "@playden/engine";
import type { ComponentType } from "react";
import { tapRace } from "@playden/game-tap-race";
import { TapRaceScreen } from "@playden/game-tap-race/view";

export interface WebGame {
  definition: AnyGame;
  View: ComponentType<GameViewProps<unknown, unknown>>;
}

/** Pairs a game with its screen; the types make sure the screen fits that game's views and moves. */
function webGame<S, M, V, C>(
  definition: GameDefinition<S, M, V, C>,
  View: ComponentType<GameViewProps<V, M>>,
): WebGame {
  // Safe: the room only ever hands a game's screen that same game's views and moves.
  return { definition, View: View as ComponentType<GameViewProps<unknown, unknown>> };
}

/**
 * Every game the web app can show. Adding a game: `pnpm new-game` adds its line here and in
 * apps/server/src/games.ts. Removing one: delete its folder and both lines.
 */
export const GAMES: readonly WebGame[] = [webGame(tapRace, TapRaceScreen)];

export function findWebGame(id: string): WebGame | undefined {
  return GAMES.find((game) => game.definition.id === id);
}

/** Games to offer; dev-only games appear only on local dev builds. */
export function listWebGames({ includeDevOnly }: { includeDevOnly: boolean }): WebGame[] {
  return GAMES.filter((game) => includeDevOnly || !game.definition.devOnly);
}
