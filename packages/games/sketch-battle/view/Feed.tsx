import { cn } from "@playden/ui/lib/utils";
import type { Pending } from "@playden/ui/lib/pending";
import { CheckIcon } from "lucide-react";
import type { Guess, TeamView } from "../types";

/** "+12.3 s": how long after this team's drawing started the guess came. */
export function sinceStart(at: number, drawFrom: number | null): string {
  return `+${(Math.max(0, at - (drawFrom ?? at)) / 1000).toFixed(1)} s`;
}

/**
 * A team's guesses, newest first, each with its time since the team's drawing started. Your
 * own guesses show faded until the server confirms them.
 */
export function Feed({
  team,
  pending = [],
  myName,
  className,
}: {
  team: TeamView;
  pending?: readonly Pending<string>[];
  myName?: string;
  className?: string;
}) {
  const nameOf = (id: string) => team.players.find((p) => p.id === id)?.name ?? "Someone";
  const guesses: Guess[] = [...(team.guesses ?? [])].reverse();
  if (guesses.length === 0 && pending.length === 0) {
    return (
      <p className={cn("px-1 py-2 text-sm text-muted-foreground", className)}>No guesses yet</p>
    );
  }
  return (
    <ul
      className={cn("flex max-h-48 flex-col divide-y overflow-y-auto", className)}
      data-tour="team-feed"
    >
      {[...pending].reverse().map((p) => (
        <li key={`p${p.id}`} className="flex items-baseline gap-2 py-1.5 opacity-50">
          <span className="shrink-0 text-sm font-semibold">{myName ?? "You"}</span>
          <span className="min-w-0 flex-1 truncate">{p.item}</span>
        </li>
      ))}
      {guesses.map((guess, i) => (
        <li
          key={`${guess.by}-${guess.at}-${i}`}
          className={cn(
            "flex items-baseline gap-2 py-1.5 duration-200 animate-in fade-in-0",
            guess.correct && "font-semibold text-success",
          )}
        >
          <span className="shrink-0 text-sm font-semibold">{nameOf(guess.by)}</span>
          <span className="min-w-0 flex-1 truncate">
            {guess.correct ? (
              <span className="inline-flex items-center gap-1">
                <CheckIcon className="size-4" /> got it!
              </span>
            ) : (
              guess.text
            )}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {sinceStart(guess.at, team.drawFrom)}
          </span>
        </li>
      ))}
    </ul>
  );
}
