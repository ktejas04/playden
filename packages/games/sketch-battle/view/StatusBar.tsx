import { cn } from "@playden/ui/lib/utils";
import { TimerIcon } from "lucide-react";
import type { SketchBattleView } from "../types";
import { TEAM_ACCENT, TEAM_NAME } from "./palette";

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
 */
export function StatusBar({ view, seconds }: { view: SketchBattleView; seconds: number | null }) {
  const guessing = view.phase === "drawing" || view.phase === "countdown";
  const urgent = view.phase === "drawing" && seconds !== null && seconds <= 5;
  return (
    <div className="flex flex-col gap-3" data-tour="timer">
      <div className="flex items-center justify-between gap-3 text-sm font-medium text-muted-foreground">
        <span>
          Round {view.roundNumber} of {view.rounds}
        </span>
        <span className="flex items-center gap-2 font-heading text-base font-bold text-foreground tabular-nums">
          {view.teams.map((team, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className="size-2.5 rounded-full"
                style={{ background: TEAM_ACCENT[i] }}
                aria-hidden
              />
              <span className="sr-only">{TEAM_NAME[i]}</span>
              <span
                key={team.score}
                className="duration-300 animate-in fade-in-0 slide-in-from-bottom-1"
              >
                {team.score}
              </span>
            </span>
          ))}
        </span>
      </div>
      {guessing && (
        <div className="flex min-h-10 items-center justify-between gap-3">
          <div className="min-w-0">
            {view.word ? (
              <p className="truncate font-heading text-2xl font-bold tracking-tight">{view.word}</p>
            ) : view.blanks ? (
              <Blanks blanks={view.blanks} />
            ) : view.phase === "drawing" ? (
              <span
                className="inline-block h-6 w-28 border-b-[3px] border-foreground/70"
                aria-label="Hidden word"
              />
            ) : null}
          </div>
          {view.phase === "drawing" && seconds !== null && (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full bg-muted px-3 py-1 font-heading text-lg font-bold tabular-nums transition-colors duration-300",
                urgent && "bg-destructive text-white",
              )}
              aria-label={`${seconds} seconds left`}
            >
              <TimerIcon className="size-4" />
              {seconds}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
