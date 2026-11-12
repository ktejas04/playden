import type { GameResult } from "@playden/engine";
import { Badge } from "@playden/ui/components/badge";
import { cn } from "@playden/ui/lib/utils";
import { FlagIcon, TrophyIcon } from "lucide-react";
import type { WebGame } from "../games";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { Panel } from "../Shell";

/** The running game's own screen, given this player's view (or the spectator view). */
export function GameStage({
  game,
  view,
  me,
  sendMove,
  serverNow,
}: {
  game: WebGame;
  view: unknown;
  me: string;
  sendMove: (move: unknown) => void;
  serverNow: () => number;
}) {
  const { View } = game;
  if (view === null) return null;
  return (
    <Panel className="mt-4">
      <View view={view} me={me} sendMove={sendMove} serverNow={serverNow} />
    </Panel>
  );
}

type Tone = "won" | "lost" | "neutral";

/** The results title for this viewer: their own outcome if they played, otherwise who won. */
function headline(
  result: GameResult,
  endedEarly: boolean,
  myId: string,
  nameOf: (id: string) => string,
  teamOf: (id: string) => number | undefined,
): { text: string; tone: Tone } {
  if (endedEarly) return { text: "Game ended early", tone: "neutral" };
  if (result.winners.length === 0) return { text: "It's a draw", tone: "neutral" };
  if (result.winners.includes(myId)) return { text: "You won!", tone: "won" };
  if (myId in result.scores) return { text: "You lost", tone: "lost" };
  // Spectators: a whole team won names the team, not each player.
  const teams = new Set(result.winners.map(teamOf));
  const [team] = teams;
  if (teams.size === 1 && team !== undefined) {
    return { text: `Team ${team + 1} won`, tone: "neutral" };
  }
  const names = result.winners.map(nameOf);
  const list =
    names.length > 2 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names.join(" and ");
  return { text: `${list} won`, tone: "neutral" };
}

/** Final scores, best first, with the winners marked. A game ended early has no winner. */
export function ResultsCard({
  result,
  endedEarly,
  nameOf,
  teamOf,
  myId,
}: {
  result: GameResult;
  endedEarly: boolean;
  nameOf: (id: string) => string;
  /** A player's team in team games; undefined otherwise. */
  teamOf: (id: string) => number | undefined;
  myId: string;
}) {
  const rows = Object.entries(result.scores).sort(([, a], [, b]) => b - a);
  const title = headline(result, endedEarly, myId, nameOf, teamOf);
  const Icon = endedEarly ? FlagIcon : TrophyIcon;
  return (
    <Panel className="mt-4 duration-300 animate-in fade-in-0 zoom-in-95">
      <h2
        className={cn(
          "flex items-center gap-2 text-2xl font-bold",
          title.tone === "lost" && "text-destructive",
        )}
      >
        <Icon
          className={cn(
            "size-6",
            title.tone === "won" || (title.tone === "neutral" && !endedEarly)
              ? "text-warning"
              : title.tone === "lost"
                ? "text-destructive"
                : "text-muted-foreground",
          )}
        />
        {title.text}
      </h2>
      {endedEarly && (
        <p className="mt-1 text-sm text-muted-foreground">Scores so far. Nobody wins this one.</p>
      )}
      <ul className="mt-3 divide-y">
        {rows.map(([id, score]) => {
          const won = result.winners.includes(id);
          return (
            <li key={id} className={cn("flex items-center gap-3 py-3", won && "font-semibold")}>
              <PlayerAvatar id={id} name={nameOf(id)} />
              <span className="flex-1 truncate">
                {nameOf(id)}
                {id === myId && <span className="text-muted-foreground"> (you)</span>}
              </span>
              {won && <Badge className="h-6 px-2 text-sm">Winner</Badge>}
              <span className="w-10 text-right tabular-nums">{score}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
