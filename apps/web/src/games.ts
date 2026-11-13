import type { AnyGame, GameDefinition, GameSettingsProps, GameViewProps } from "@playden/engine";
import type { ComponentType } from "react";
import { tapRace } from "@playden/game-tap-race";
import { TapRaceScreen, TapRaceSettings } from "@playden/game-tap-race/view";
import { sketchBattle } from "@playden/game-sketch-battle";
import { SketchBattleScreen } from "@playden/game-sketch-battle/view";

export interface WebGame {
  definition: AnyGame;
  View: ComponentType<GameViewProps<unknown, unknown>>;
  /** The game's own settings view, if it has settings the host can change. */
  Settings?: ComponentType<GameSettingsProps<unknown>>;
}

/**
 * Pairs a game with its screen and, optionally, its settings view; the types make sure each
 * fits that game's views, moves and config.
 */
function webGame<S, M, V, C>(
  definition: GameDefinition<S, M, V, C>,
  View: ComponentType<GameViewProps<V, M>>,
  Settings?: ComponentType<GameSettingsProps<C>>,
): WebGame {
  // Safe: the room only ever hands a game's views that same game's views, moves and config.
  return {
    definition,
    View: View as ComponentType<GameViewProps<unknown, unknown>>,
    Settings: Settings as ComponentType<GameSettingsProps<unknown>> | undefined,
  };
}

/**
 * Every game the web app can show. Adding a game: `pnpm new-game` adds its line here and in
 * apps/server/src/games.ts. Removing one: delete its folder and both lines.
 */
export const GAMES: readonly WebGame[] = [
  webGame(sketchBattle, SketchBattleScreen),
  webGame(tapRace, TapRaceScreen, TapRaceSettings),
];

export function findWebGame(id: string): WebGame | undefined {
  return GAMES.find((game) => game.definition.id === id);
}

/** Games to offer; dev-only games appear only on local dev builds. */
export function listWebGames({ includeDevOnly }: { includeDevOnly: boolean }): WebGame[] {
  return GAMES.filter((game) => includeDevOnly || !game.definition.devOnly);
}
