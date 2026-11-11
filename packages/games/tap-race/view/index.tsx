import type { GameViewProps } from "@playden/engine";
import { Button } from "@playden/ui/components/button";
import { useEffect, useState } from "react";
import type { Standing, TapRaceMove, TapRaceView } from "../types";

const STANDING_TEXT: Record<Standing, string> = {
  ahead: "You're ahead",
  behind: "You're behind",
  level: "Neck and neck",
};

function useSecondsLeft(endsAt: number, serverNow: () => number): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(timer);
  }, [serverNow]);
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

function teamName(team: number): string {
  return `Team ${team + 1}`;
}

export function TapRaceScreen({
  view,
  sendMove,
  serverNow,
}: GameViewProps<TapRaceView, TapRaceMove>) {
  const secondsLeft = useSecondsLeft(view.endsAt, serverNow);

  if (view.ended) {
    const { winningTeam, counts } = view.ended;
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <h2 className="text-3xl font-bold">
          {winningTeam === null ? "It's a draw" : `${teamName(winningTeam)} wins`}
        </h2>
        <p className="text-muted-foreground">
          {counts.map((c, i) => `${teamName(i)}: ${c}`).join(" · ")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">
        First to {view.target} · {secondsLeft}s left
      </p>
      {view.role === "player" ? (
        <>
          <div>
            <p className="text-6xl font-bold tabular-nums">{view.ownCount}</p>
            <p className="mt-1 text-muted-foreground">
              {teamName(view.team)} · {STANDING_TEXT[view.standing]}
            </p>
          </div>
          <Button
            size="xl"
            className="h-32 w-full max-w-xs text-2xl"
            onClick={() => sendMove({ type: "tap" })}
          >
            Tap!
          </Button>
        </>
      ) : (
        <p className="text-4xl font-bold tabular-nums">{view.counts.join(" – ")}</p>
      )}
    </div>
  );
}
