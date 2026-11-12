import { type ReactNode, createContext, useContext, useMemo } from "react";
import { assignPlayerColors, playerColor } from "../playerColor";

const PlayerColors = createContext<ReadonlyMap<string, number>>(new Map());

/** Gives everyone listed a different colour (assignPlayerColors) for the avatars inside. */
export function PlayerColorsProvider({ ids, children }: { ids: string[]; children: ReactNode }) {
  // Recomputed only when the list itself changes, not on every render's new array.
  const key = ids.join(",");
  const colors = useMemo(() => assignPlayerColors(key ? key.split(",") : []), [key]);
  return <PlayerColors.Provider value={colors}>{children}</PlayerColors.Provider>;
}

/** This player's colour slot in the current room, or their usual one outside rooms. */
export function usePlayerColor(id: string): number {
  return useContext(PlayerColors).get(id) ?? playerColor(id);
}
