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
