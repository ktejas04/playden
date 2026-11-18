import { cn } from "@playden/ui/lib/utils";
import type { TeamIndex, TeamView } from "../types";
import { Canvas } from "./Canvas";
import { AttemptTracker, Feed } from "./Feed";
import { TEAM_NAME } from "./palette";
import { PixelView } from "./PixelView";

/**
 * The opponent's drawing matching original draw battle:
 * - Top header: "team 1" on left, "✏ drawer" on right
 * - Canvas / pixel view
 * - Underneath: their ✕ / ✓ marks, so you see how close they are; their guesses themselves
 *   once your team has guessed (section 6)
 */
export function OpponentStrip({
  team,
  index,
  className,
}: {
  team: TeamView;
  index: TeamIndex;
  className?: string;
}) {
  const drawer = team.players.find((p) => p.id === team.drawerId)?.name ?? "Someone";
  return (
    <div className={cn("flex flex-col gap-1.5", className)} data-tour="opponent-preview">
      <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
        <span>{TEAM_NAME[index]}</span>
        <span className="flex items-center gap-1 font-normal">
          <span>✏</span> {drawer}
        </span>
      </div>
      <div
        className={cn(
          "relative aspect-[3/2] w-full overflow-hidden rounded-xl border-2 transition-all duration-300 shadow-xs",
          team.solvedAt !== null ? "border-success" : "border-border",
        )}
      >
        {team.canvas.kind === "cells" ? (
          <PixelView cells={team.canvas.cells} className="size-full rounded-none border-none" />
        ) : (
          <Canvas
            ops={team.canvas.ops}
            smooth={false}
            label={`${TEAM_NAME[index]}'s drawing`}
            className="size-full rounded-none border-none"
          />
        )}
      </div>
      <AttemptTracker team={team} />
      {team.guesses && team.guesses.length > 0 && <Feed team={team} roles={false} />}
    </div>
  );
}
