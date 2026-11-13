/**
 * What the room hands a game's screen. Plain types only, so the engine stays free of React;
 * each game's `view/index.tsx` exports a component taking these props.
 */
export interface GameViewProps<View, Move> {
  /** This player's view, from the game's `view(state, playerId)`. */
  view: View;
  /** The viewer's player id, or "spectator". */
  me: string;
  /** Sends a move; the room answers with a new view or an error. */
  sendMove: (move: Move) => void;
  /** Server time now, in milliseconds, corrected for this device's clock. */
  serverNow: () => number;
}

/**
 * What the room hands a game's optional settings view (`view/index.tsx` exports it beside the
 * game screen). The config is the game's own shape, any shape; the platform only stores it,
 * checks it with the game's `configSchema`, and shows this view in setup. The host can edit
 * (`canEdit`); everyone else sees the same view read-only.
 */
export interface GameSettingsProps<Config> {
  config: Config;
  canEdit: boolean;
  /** The whole new config; the room checks it with the game's schema and tells everyone. */
  onChange: (next: Config) => void;
}
