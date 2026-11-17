import { cn } from "@playden/ui/lib/utils";
import type { Pending } from "@playden/ui/lib/pending";
import type { Guess, TeamView } from "../types";

/** Row of mini attempt marks under the canvas: ✓ (green) and ✕ (red). */
export function AttemptTracker({ team, className }: { team: TeamView; className?: string }) {
  // From the counts, not the guesses: the other team's texts are hidden, their marks are not.
  const marks = [
    ...Array.from({ length: team.wrongGuesses }, () => false),
    ...(team.solvedAt !== null ? [true] : []),
  ];
  if (marks.length === 0) return null;
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5 py-1 text-sm font-bold", className)}
      aria-label="Guess attempts"
    >
      {marks.map((correct, i) =>
        correct ? (
          <span key={i} className="text-emerald-600 dark:text-emerald-400">
            ✓
          </span>
        ) : (
          <span key={i} className="text-rose-600 dark:text-rose-400">
            ✕
          </span>
        ),
      )}
    </div>
  );
}

/**
 * A team's guess feed, newest guess first. Each line is one colour: a right guess all green, a
 * wrong one all red, a guess still on its way all muted.
 * - ✓ <name> guessed <word>
 * - ✕ <name> guessed <word>
 * - ! <name> is guessing
 * - ✏ <name> is drawing
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
  const drawer = team.players.find((p) => p.id === team.drawerId);
  const guessers = team.players.filter((p) => p.id !== team.drawerId);
  const guesses: Guess[] = [...(team.guesses ?? [])].reverse();

  return (
    <div className={cn("flex flex-col gap-1 text-sm font-medium", className)} data-tour="team-feed">
      {/* Pending guesses */}
      {[...pending].reverse().map((p) => (
        <div key={`p${p.id}`} className="flex items-center gap-2 text-muted-foreground opacity-60">
          <span className="font-bold">·</span>
          <span>
            {myName ?? "You"} guessed <span className="font-semibold">{p.item}</span>
          </span>
        </div>
      ))}

      {/* Confirmed guesses (newest on top) */}
      {guesses.map((guess, i) => (
        <div
          key={`${guess.by}-${guess.at}-${i}`}
          className={cn(
            "flex items-center gap-2 duration-150 animate-in fade-in-0",
            guess.correct
              ? "font-semibold text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400",
          )}
        >
          <span className="font-bold">{guess.correct ? "✓" : "✕"}</span>
          <span>
            {nameOf(guess.by)} guessed <span className="font-semibold">{guess.text}</span>
          </span>
        </div>
      ))}

      {/* Active role status indicators */}
      {guessers.map((g) => (
        <div key={`guess-${g.id}`} className="flex items-center gap-2 text-muted-foreground">
          <span className="font-bold">!</span>
          <span>{g.name} is guessing</span>
        </div>
      ))}
      {drawer && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>✏</span>
          <span>{drawer.name} is drawing</span>
        </div>
      )}
    </div>
  );
}
