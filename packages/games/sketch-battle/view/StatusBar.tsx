import { cn } from "@playden/ui/lib/utils";
import { TimerIcon } from "lucide-react";
import type { SketchBattleView } from "../types";
import { TEAM_ACCENT } from "./palette";

/** The word as blank slots: one per letter or digit, gaps for spaces, punctuation as is. */
export function Blanks({ blanks }: { blanks: string }) {
  return (
    <span
      className="flex flex-wrap items-end gap-x-1 gap-y-2"
      aria-label={`${blanks.replace(/[^_]/g, "").length} letters`}
    >
      {[...blanks].map((char, i) =>
        char === "_" ? (
          <span key={i} className="inline-block h-6 w-3.5 border-b-[3px] border-foreground/70" />
        ) : char === " " ? (
          <span key={i} className="inline-block w-3" />
        ) : (
          <span key={i} className="font-heading text-xl leading-6 font-bold">
            {char}
          </span>
        ),
      )}
    </span>
  );
}

/**
 * The top of the game: what this viewer knows of the word, the time left and the scores.
 * Drawers and spectators see the word; guessers see blanks until their team gets it.
 * On a narrow board the word gets its own full-width line under the matchup and timer, so a
 * long word's blanks never squeeze in beside them and push the canvas down.
 */
export function StatusBar({ view, seconds }: { view: SketchBattleView; seconds: number | null }) {
  const guessing = view.phase === "drawing" || view.phase === "countdown";
  const racing = view.phase === "showdown";
  const urgent = view.phase === "drawing" && seconds !== null && seconds <= 5;
  const myTeam = view.me.team ?? 0;
  const isSolved = view.teams[myTeam]?.solvedAt !== null;
  const drawer0 =
    view.teams[0].players.find((p) => p.id === view.teams[0].drawerId)?.name ?? "Drawer 1";
  const drawer1 =
    view.teams[1].players.find((p) => p.id === view.teams[1].drawerId)?.name ?? "Drawer 2";

  return (
    <div className="@container" data-tour="timer">
      <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 py-1 @xl:flex @xl:justify-between @xl:gap-4">
        <div
          className={cn(
            "order-last col-span-2 flex min-h-8 min-w-0 items-end @xl:order-none @xl:min-h-0",
            // Spectators get each team's showdown word above its canvas instead.
            racing && view.me.role === "spectator" && "hidden",
          )}
        >
          {view.word ? (
            <p
              className={cn(
                "truncate font-heading text-xl sm:text-2xl font-bold tracking-tight",
                isSolved && "text-success",
              )}
            >
              {view.word}
            </p>
          ) : view.blanks ? (
            <Blanks blanks={view.blanks} />
          ) : (view.phase === "drawing" || racing) && view.me.role !== "spectator" ? (
            <span
              className="inline-block h-6 w-28 border-b-[3px] border-foreground/70"
              aria-label="Hidden word"
            />
          ) : null}
        </div>

        {view.showdown ? (
          <div
            className="flex w-fit shrink-0 items-center gap-2 rounded-full border border-border/50 bg-muted/60 px-3 py-1 font-heading text-base font-bold tabular-nums sm:text-lg"
            aria-label={`Words finished: Team 1 ${view.showdown.done[0]}, Team 2 ${view.showdown.done[1]}`}
          >
            <span style={{ color: TEAM_ACCENT[0] }}>{view.showdown.done[0]}</span>
            <span className="font-normal text-muted-foreground/60">–</span>
            <span style={{ color: TEAM_ACCENT[1] }}>{view.showdown.done[1]}</span>
          </div>
        ) : (
          <div className="flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-border/50 bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground sm:text-sm">
            <span className="flex items-center gap-1" style={{ color: TEAM_ACCENT[0] }}>
              <span>✏</span> {drawer0}
            </span>
            <span className="font-normal text-muted-foreground/60">vs</span>
            <span className="flex items-center gap-1" style={{ color: TEAM_ACCENT[1] }}>
              <span>✏</span> {drawer1}
            </span>
          </div>
        )}

        {guessing && seconds !== null && (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1 font-heading text-base sm:text-lg font-bold tabular-nums transition-colors duration-300",
              urgent && "bg-destructive text-white",
            )}
            aria-label={`${seconds} seconds left`}
          >
            <TimerIcon className="size-4" />
            {seconds}
          </span>
        )}
      </div>
    </div>
  );
}
