import { cn } from "@playden/ui/lib/utils";
import { CheckIcon, ClockIcon, PencilIcon, TrophyIcon } from "lucide-react";
import { SHOWDOWN_FINISH_BONUS, SHOWDOWN_WORD_POINTS } from "../config";
import type { ShowdownView, SketchBattleView, TeamIndex, TeamView } from "../types";
import { TEAM_ACCENT, TEAM_NAME } from "./palette";
import { wordTable } from "./showdownTable";

/** The title card's entrance: dealt onto the table, unhurried (spec section 13). */
const DEAL_MS = 700;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const TEAMS = [0, 1] as const;

/** A team's players in drawing order, starting with its first showdown drawer. */
function drawingOrder(team: TeamView): TeamView["players"] {
  const players = team.players.filter((p) => !p.left);
  const start = Math.max(
    0,
    players.findIndex((p) => p.id === team.drawerId),
  );
  return [...players.slice(start), ...players.slice(0, start)];
}

/** The showdown screens share one frame, so nothing jumps between them. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center gap-8 py-6 text-center sm:min-h-[24rem]">
      {children}
    </div>
  );
}

/** S9: the title card, each team's drawing order, and the count to the 3-2-1. */
export function ShowdownIntro({
  view,
  seconds,
}: {
  view: SketchBattleView;
  seconds: number | null;
}) {
  const total = view.showdown?.total ?? 0;
  return (
    <Frame>
      <div
        className="flex flex-col items-center gap-2 animate-in fade-in-0 zoom-in-90 slide-in-from-top-8 motion-reduce:animate-none"
        style={{ animationDuration: `${DEAL_MS}ms`, animationTimingFunction: EASE }}
      >
        <p className="font-heading text-4xl font-bold sm:text-5xl">showdown</p>
        <p className="text-base text-muted-foreground">
          {total} words · +{SHOWDOWN_WORD_POINTS} each · +{SHOWDOWN_FINISH_BONUS} to finish first
        </p>
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-6">
        {TEAMS.map((t) => (
          <div
            key={t}
            className="flex min-w-0 flex-col items-center gap-3 animate-in fade-in-0 fill-mode-backwards motion-reduce:animate-none"
            style={{
              animationDuration: `${DEAL_MS}ms`,
              animationDelay: `${DEAL_MS / 2}ms`,
              animationTimingFunction: EASE,
            }}
          >
            <span
              className="font-heading text-5xl font-bold tabular-nums"
              style={{ color: TEAM_ACCENT[t] }}
              aria-label={`${TEAM_NAME[t]}: ${view.teams[t].score} points`}
            >
              {view.teams[t].score}
            </span>
            <ol className="flex flex-col items-center gap-0.5">
              {drawingOrder(view.teams[t]).map((p, i) => (
                <li
                  key={p.id}
                  className={cn(
                    "relative text-base",
                    i === 0 ? "font-heading text-xl font-bold" : "font-medium",
                  )}
                >
                  {i === 0 && (
                    <PencilIcon
                      className="absolute top-1/2 right-full mr-1.5 size-4 -translate-y-1/2"
                      style={{ color: TEAM_ACCENT[t] }}
                      aria-label="draws first"
                    />
                  )}
                  {p.name}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {seconds !== null && (
        <p className="font-heading text-lg font-semibold text-muted-foreground tabular-nums">
          starts in {seconds}
        </p>
      )}
    </Frame>
  );
}

/** The 5 s result after the showdown: the game's outcome for this viewer, then the results. */
export function ShowdownResult({ view }: { view: SketchBattleView }) {
  const [a, b] = [view.teams[0].score, view.teams[1].score];
  const winner: TeamIndex | null = a === b ? null : a > b ? 0 : 1;
  const mine = view.me.team;
  const tone = winner === null ? "neutral" : mine === null || mine === winner ? "won" : "lost";
  const title =
    winner === null
      ? "it's a draw!"
      : mine === null
        ? `${TEAM_NAME[winner]} wins!`
        : mine === winner
          ? "you win!"
          : "you lost";
  const first = view.showdown?.winnerTeam;
  const colour =
    tone === "won" ? "text-success" : tone === "lost" ? "text-destructive" : "text-foreground";

  return (
    <Frame>
      <div
        className="flex flex-col items-center gap-3 duration-300 animate-in fade-in-0 zoom-in-95"
        role="status"
      >
        {tone === "lost" ? (
          <ClockIcon className={cn("size-14", colour)} strokeWidth={1.75} aria-hidden />
        ) : (
          <TrophyIcon className="size-16 text-amber-500" strokeWidth={1.75} aria-hidden />
        )}
        <p className={cn("font-heading text-3xl font-bold sm:text-4xl", colour)}>{title}</p>
        {first !== null && first !== undefined && (
          <p className="font-heading text-lg font-semibold text-muted-foreground">
            {TEAM_NAME[first]} finished the showdown first
          </p>
        )}
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-6">
        {TEAMS.map((t) => (
          <div key={t} className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold" style={{ color: TEAM_ACCENT[t] }}>
              {TEAM_NAME[t]}
            </span>
            <span
              className="font-heading text-5xl font-bold tabular-nums"
              style={{ color: TEAM_ACCENT[t] }}
            >
              {view.teams[t].score}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

/**
 * Spectators' view of the race (SB22): both teams' words in showdown order, each finished word
 * in green and a blank line for each still ahead. Players never get this (SB18).
 */
export function WordTrack({ showdown }: { showdown: ShowdownView }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-center">
      {TEAMS.map((t) => (
        <span
          key={t}
          className="pb-1 font-heading text-base font-bold"
          style={{ color: TEAM_ACCENT[t] }}
        >
          {TEAM_NAME[t]}
        </span>
      ))}
      {Array.from({ length: showdown.total }, (_, i) =>
        TEAMS.map((t) => {
          const word = showdown.finished[t]?.[i];
          return word ? (
            <span
              key={`${t}-${i}`}
              className="min-w-0 font-heading text-base leading-6 font-semibold break-words text-success duration-300 animate-in fade-in-0 motion-reduce:animate-none"
            >
              {word}
            </span>
          ) : (
            <span key={`${t}-${i}`} className="flex h-6 items-center justify-center" aria-hidden>
              <span className="h-0.5 w-8 rounded-full bg-border" />
            </span>
          );
        }),
      )}
    </div>
  );
}

/**
 * A player's showdown table, as the original's sidebar (SB30): a column per team, theirs
 * first; their finished words in green, the other team's as a ✓, blanks for the rest.
 */
export function WordTable({ showdown, team }: { showdown: ShowdownView; team: TeamIndex }) {
  const columns = wordTable(showdown, team);
  return (
    <table className="w-full table-fixed text-center" aria-label="Showdown words">
      <thead>
        <tr>
          {columns.map(({ team: t }) => (
            <th
              key={t}
              className="pb-1 text-sm font-semibold whitespace-nowrap"
              style={{ color: TEAM_ACCENT[t] }}
            >
              {TEAM_NAME[t]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: showdown.total }, (_, row) => (
          <tr key={row} className="h-7">
            {columns.map(({ team: t, cells }) => {
              const cell = cells[row];
              return (
                <td key={t} className="px-1 align-middle">
                  {cell?.kind === "word" ? (
                    <span className="block truncate font-heading text-sm font-semibold text-success">
                      {cell.word}
                    </span>
                  ) : cell?.kind === "check" ? (
                    <CheckIcon className="mx-auto size-4 text-success" aria-label="done" />
                  ) : (
                    <span className="mx-auto block h-0 w-14 border-b-2 border-foreground/40" />
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
