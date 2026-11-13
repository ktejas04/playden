import { CheckIcon, PencilIcon } from "lucide-react";
import type { TeamIndex, TeamView } from "../types";
import { Canvas } from "./Canvas";
import { sinceStart } from "./Feed";
import { TEAM_ACCENT, TEAM_NAME } from "./palette";
import { PixelView } from "./PixelView";

/**
 * The other team in a compact strip: their pixel view (D47) until your team guesses, then
 * their real drawing; who draws; whether they've got it.
 */
export function OpponentStrip({ team, index }: { team: TeamView; index: TeamIndex }) {
  const drawer = team.players.find((p) => p.id === team.drawerId)?.name ?? "Someone";
  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-muted/40 p-2"
      data-tour="opponent-preview"
    >
      <div className="w-32 shrink-0 sm:w-40">
        {team.canvas.kind === "cells" ? (
          <PixelView cells={team.canvas.cells} />
        ) : (
          <Canvas
            ops={team.canvas.ops}
            smooth={false}
            label={`${TEAM_NAME[index]}'s drawing`}
            className="border"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-heading font-bold">
          <span
            className="size-2.5 rounded-full"
            style={{ background: TEAM_ACCENT[index] }}
            aria-hidden
          />
          {TEAM_NAME[index]}
        </p>
        <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
          <PencilIcon className="size-3.5 shrink-0" /> {drawer}
        </p>
        {team.solvedAt !== null && (
          <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-success duration-300 animate-in fade-in-0 slide-in-from-left-1">
            <CheckIcon className="size-4" /> Got it {sinceStart(team.solvedAt, team.drawFrom)}
          </p>
        )}
      </div>
    </div>
  );
}
