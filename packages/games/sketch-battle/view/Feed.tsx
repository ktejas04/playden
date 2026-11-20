import { cn } from "@playden/ui/lib/utils";
import type { Pending } from "@playden/ui/lib/pending";
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import type { TeamView } from "../types";
import {
  type FeedHeader,
  type FeedLine,
  attemptMarks,
  elapsedLabel,
  feedLines,
  guessersLine,
  teamWords,
} from "./feedMessages";

/** The other team's ✓ / ✕ marks, newest first, until your team guesses (SB31). */
export function AttemptTracker({ team, className }: { team: TeamView; className?: string }) {
  // From the counts, not the guesses: the other team's texts are hidden, their marks are not.
  const marks = attemptMarks(team);
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
 * A team's guess feed, as the original's (SB29). Lines in time order: per word the headers
 * asked for ("<drawer> is drawing", "<a> and <b> are guessing"), then its guesses, a right one
 * green and a wrong one red, the time since the word began on hover. On a phone the newest
 * line is on top and the feed grows with the page; wider, the oldest is on top in a box no
 * taller than `maxHeight`, kept scrolled to the newest, with a fade at the top once there's
 * more above. Guesses still on their way show faded, newest of all.
 */
export function Feed({
  team,
  headers,
  pending = [],
  myName,
  maxHeight,
  small = false,
  className,
}: {
  team: TeamView;
  headers: readonly FeedHeader[];
  pending?: readonly Pending<string>[];
  myName?: string;
  /** The tallest the feed gets on screens wider than a phone, e.g. the canvas's height. */
  maxHeight?: number;
  /** Smaller text, for the other team's box. */
  small?: boolean;
  className?: string;
}) {
  const nameOf = (id: string) => team.players.find((p) => p.id === id)?.name ?? "Someone";
  const guessers = team.players.filter((p) => p.id !== team.drawerId).map((p) => p.name);
  const lines = feedLines(teamWords(team), headers);
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const toNewest = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    box.scrollTop = box.scrollHeight;
    setMore(box.scrollTop > 0);
  }, []);
  useEffect(toNewest, [toNewest, lines.length, pending.length, maxHeight]);
  useEffect(() => {
    window.addEventListener("resize", toNewest);
    return () => window.removeEventListener("resize", toNewest);
  }, [toNewest]);

  const line = (item: FeedLine) => {
    if (item.kind !== "guess") {
      const text =
        item.kind === "drawer" ? `${nameOf(item.drawerId)} is drawing` : guessersLine(guessers);
      return text ? (
        <div key={item.key} className="flex items-center gap-2 text-muted-foreground">
          <span className={item.kind === "guessers" ? "font-bold" : undefined}>
            {item.kind === "drawer" ? "✏" : "!"}
          </span>
          <span>{text}</span>
        </div>
      ) : null;
    }
    const { guess, elapsedMs } = item;
    return (
      <div
        key={item.key}
        title={elapsedMs === null ? undefined : elapsedLabel(elapsedMs)}
        className={cn(
          "flex items-center gap-2 duration-150 animate-in fade-in-0",
          guess.correct
            ? "font-semibold text-emerald-600 dark:text-emerald-400"
            : "text-rose-600 dark:text-rose-400",
        )}
      >
        <span className="font-bold">{guess.correct ? "✓" : "✕"}</span>
        <span className="min-w-0 break-words">
          {nameOf(guess.by)} guessed <span className="font-semibold">{guess.text}</span>
        </span>
      </div>
    );
  };

  return (
    <div className={cn("relative min-h-0", className)} data-tour="team-feed">
      <div
        ref={scroller}
        onScroll={(event) => setMore(event.currentTarget.scrollTop > 0)}
        className={cn(
          "flex flex-col-reverse gap-1 font-medium *:shrink-0 min-[601px]:flex-col min-[601px]:overflow-y-auto",
          small ? "text-sm min-[601px]:text-xs" : "text-sm",
          maxHeight !== undefined && "min-[601px]:max-h-(--feed-max)",
        )}
        style={
          maxHeight === undefined
            ? undefined
            : ({ "--feed-max": `${maxHeight}px` } as CSSProperties)
        }
      >
        {lines.map(line)}
        {pending.map((p) => (
          <div
            key={`p${p.id}`}
            className="flex items-center gap-2 text-muted-foreground opacity-60"
          >
            <span className="font-bold">·</span>
            <span>
              {myName ?? "You"} guessed <span className="font-semibold">{p.item}</span>
            </span>
          </div>
        ))}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 hidden h-6 bg-gradient-to-b from-card to-transparent opacity-0 transition-opacity duration-200 min-[601px]:block",
          more && "opacity-100",
        )}
      />
    </div>
  );
}
