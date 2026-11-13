import { Button } from "@playden/ui/components/button";
import type { SketchBattleMove, SketchBattleView } from "../types";
import { TEAM_ACCENT } from "./palette";

function nameOf(view: SketchBattleView, id: string | null): string {
  for (const team of view.teams) {
    const player = team.players.find((p) => p.id === id);
    if (player) return player.name;
  }
  return "Someone";
}

/** A countdown ring around the seconds left, drawn with a conic gradient. */
function Ring({ seconds, total }: { seconds: number; total: number }) {
  const share = Math.max(0, Math.min(1, seconds / total));
  return (
    <div
      className="grid size-14 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--primary) ${share * 360}deg, var(--muted) 0deg)`,
      }}
      aria-label={`${seconds} seconds to choose`}
    >
      <span className="grid size-11 place-items-center rounded-full bg-card font-heading text-lg font-bold tabular-nums">
        {seconds}
      </span>
    </div>
  );
}

/**
 * S2: both drawers see the two words, only the chooser can tap one. Everyone else sees the
 * matchup and who is choosing.
 */
export function ChooseStage({
  view,
  seconds,
  total,
  sendMove,
}: {
  view: SketchBattleView;
  seconds: number;
  total: number;
  sendMove: (move: SketchBattleMove) => void;
}) {
  const [a, b] = view.teams;
  const chooser = nameOf(view, view.chooserId);
  const iChoose =
    view.me.role === "drawer" && view.teams[view.me.team ?? 0].drawerId === view.chooserId;
  return (
    <div className="flex flex-col items-center gap-5 py-4 text-center duration-300 animate-in fade-in-0">
      <div className="flex items-center gap-3 font-heading text-xl font-bold">
        <span style={{ color: TEAM_ACCENT[0] }}>{nameOf(view, a.drawerId)}</span>
        <span className="text-sm font-medium text-muted-foreground">vs</span>
        <span style={{ color: TEAM_ACCENT[1] }}>{nameOf(view, b.drawerId)}</span>
      </div>
      <Ring seconds={seconds} total={total} />
      {view.choices ? (
        <>
          <p className="text-muted-foreground">
            {iChoose ? "Pick the word you both draw" : `${chooser} picks the word`}
          </p>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            {view.choices.map((word, index) => (
              <Button
                key={word}
                variant="outline"
                disabled={!iChoose}
                className="h-20 rounded-2xl bg-tile font-heading text-2xl font-bold text-tile-foreground [--edge:var(--tile-edge)] disabled:opacity-80"
                onClick={() => sendMove({ type: "choose", index: index as 0 | 1 })}
              >
                {word}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <p className="text-lg text-muted-foreground">{chooser} is choosing…</p>
      )}
    </div>
  );
}

export { nameOf };
