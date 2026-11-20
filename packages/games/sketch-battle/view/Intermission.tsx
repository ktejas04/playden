import { Button } from "@playden/ui/components/button";
import { cn } from "@playden/ui/lib/utils";
import { CheckIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { nextDrawer } from "../rotation";
import type { CanvasOp, SketchBattleMove, SketchBattleView, TeamIndex, TeamView } from "../types";
import { prepare, useCanvasSize } from "./Canvas";
import { drawerBadge } from "./Badges";
import { Feed } from "./Feed";
import { PAPER, TEAM_ACCENT, TEAM_NAME } from "./palette";
import { drawOps, opsUpTo, stepCount } from "./strokes";

/**
 * The drawer handoff, unhurried: a beat to read the names, the strike draws across the
 * outgoing drawer, a pause on it, the name lifts away, then the next drawer eases in and the
 * on-deck names follow one by one. Stage times from the summary opening, in milliseconds.
 */
const HANDOFF_STAGES = { strike: 700, leave: 2300, arrive: 2800 } as const;
type HandoffStage = "read" | keyof typeof HANDOFF_STAGES;
/** How long each step of the handoff takes, and the gap between on-deck names. */
const STRIKE_MS = 800;
const LEAVE_MS = 450;
const ARRIVE_MS = 800;
const DECK_STAGGER_MS = 120;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Steps through the handoff stages once, from mount. */
function useHandoff(): HandoffStage {
  const [stage, setStage] = useState<HandoffStage>("read");
  useEffect(() => {
    const timers = (Object.keys(HANDOFF_STAGES) as (keyof typeof HANDOFF_STAGES)[]).map((key) =>
      setTimeout(() => setStage(key), HANDOFF_STAGES[key]),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return stage;
}

function ReplayCanvas({
  ops,
  label,
  accent,
  replayKey,
}: {
  ops: readonly CanvasOp[];
  label: string;
  accent?: string;
  replayKey: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const width = useCanvasSize(box);

  useEffect(() => {
    prepare(canvasRef.current, width);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || width === 0) return;

    const totalSteps = stepCount(ops);
    if (replayKey === 0 || totalSteps === 0) {
      ctx.clearRect(0, 0, width, (width * 2) / 3);
      drawOps(ctx, ops, width);
      return;
    }

    ctx.clearRect(0, 0, width, (width * 2) / 3);
    let currentStep = 0;
    let animId = 0;
    const startTime = performance.now();
    const durationMs = Math.min(2500, Math.max(1000, totalSteps * 15));

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const targetStep = Math.round(progress * totalSteps);
      if (targetStep > currentStep) {
        currentStep = targetStep;
        ctx.clearRect(0, 0, width, (width * 2) / 3);
        drawOps(ctx, opsUpTo(ops, currentStep), width);
      }
      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      }
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [ops, width, replayKey]);

  return (
    <div
      ref={box}
      className="relative aspect-[3/2] w-full overflow-hidden rounded-xl border-2 shadow-xs transition-colors"
      style={{ background: PAPER, borderColor: accent }}
    >
      <canvas
        ref={canvasRef}
        aria-label={label}
        role="img"
        className="absolute inset-0 size-full"
      />
    </div>
  );
}

/** The summary's frame: the lineup centred, the buttons at the bottom. */
function Frame({ children, action }: { children: ReactNode; action: ReactNode }) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-between gap-8 py-4 text-center sm:min-h-[24rem] sm:py-6">
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-6">
        {children}
      </div>
      {action}
    </div>
  );
}

function Cta({
  children,
  onClick,
  variant,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "outline";
  disabled?: boolean;
}) {
  return (
    <Button
      size="xl"
      variant={variant}
      disabled={disabled}
      className="w-full max-w-sm font-heading"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

interface Lineup {
  /** Who drew the round that just ended. */
  outgoing: string;
  /** Who draws next: the same player when the team didn't rotate. */
  incoming: string;
  /** The rest of the team in drawing order, before and after the swap. */
  deckBefore: string[];
  deckAfter: string[];
}

/** The team's players in drawing order, starting after `from`, without `from` itself. */
function after(team: TeamView, from: string): string[] {
  const ids = team.players.filter((p) => !p.left).map((p) => p.id);
  const start = ids.indexOf(from);
  return ids.length === 0
    ? []
    : ids.map((_, i) => ids[(start + 1 + i) % ids.length] ?? "").filter((id) => id !== from);
}

/** The same rule as the engine's next round: the winning drawer stays (section 8). */
function lineupFor(team: TeamView, outgoing: string, won: boolean): Lineup {
  const rotation = team.players.map((p) => p.id);
  const unavailable = new Set(team.players.filter((p) => p.away || p.left).map((p) => p.id));
  const incoming = nextDrawer(rotation, outgoing, won, unavailable);
  return {
    outgoing,
    incoming,
    deckBefore: after(team, outgoing),
    deckAfter: after(team, incoming),
  };
}

/** One team's column: score, drawer slot (struck off and replaced), and who is on deck. */
function TeamLineup({
  team,
  index,
  lineup,
  stage,
  ready,
  badge,
}: {
  team: TeamView;
  index: TeamIndex;
  lineup: Lineup | null;
  stage: HandoffStage;
  ready: ReadonlySet<string>;
  /** The next drawer's streak or head start badge (section 7), shown once they're in place. */
  badge: ReactNode;
}) {
  /** A player's name, with a tick once they've tapped Continue. */
  const name = (id: string) => (
    <span className="relative">
      {team.players.find((p) => p.id === id)?.name ?? "Someone"}
      {ready.has(id) && (
        <CheckIcon
          className="absolute top-1/2 left-full ml-1 size-4 -translate-y-1/2 text-success"
          aria-label="ready"
        />
      )}
    </span>
  );
  const rotates = lineup !== null && lineup.incoming !== lineup.outgoing;
  const arrived = !rotates || stage === "arrive";
  const struck = stage !== "read";
  const deck = lineup === null ? [] : arrived ? lineup.deckAfter : lineup.deckBefore;

  return (
    <div className="flex min-w-0 flex-col items-center gap-3">
      <span
        className="font-heading text-5xl font-bold tabular-nums sm:text-6xl"
        style={{ color: TEAM_ACCENT[index] }}
        aria-label={`${TEAM_NAME[index]}: ${team.score} points`}
      >
        {team.score}
      </span>
      {lineup && (
        <>
          <span className="flex h-9 items-center font-heading text-2xl font-bold">
            {arrived ? (
              <span
                key={lineup.incoming}
                className={cn(
                  rotates &&
                    "animate-in fade-in-0 slide-in-from-bottom-3 motion-reduce:animate-none",
                )}
                style={{ animationDuration: `${ARRIVE_MS}ms`, animationTimingFunction: EASE }}
              >
                {name(lineup.incoming)}
              </span>
            ) : (
              <span
                className={cn(
                  "relative inline-block px-1 transition-[opacity,translate,color] motion-reduce:transition-none",
                  struck && "text-muted-foreground",
                  stage === "leave" && "-translate-y-2 opacity-0",
                )}
                style={{
                  transitionDuration: `${stage === "leave" ? LEAVE_MS : STRIKE_MS}ms`,
                  transitionTimingFunction: EASE,
                }}
              >
                {name(lineup.outgoing)}
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 origin-left rounded-full bg-destructive transition-transform motion-reduce:transition-none"
                  style={{
                    transform: `scaleX(${struck ? 1 : 0})`,
                    transitionDuration: `${STRIKE_MS}ms`,
                    transitionTimingFunction: EASE,
                  }}
                />
              </span>
            )}
          </span>
          {badge && (
            // The row is kept while the challenger's name arrives, so nothing below it jumps.
            <span className="flex h-6 items-center">
              {arrived && (
                <span
                  className="animate-in fade-in-0 motion-reduce:animate-none"
                  style={{ animationDuration: `${ARRIVE_MS}ms`, animationTimingFunction: EASE }}
                >
                  {badge}
                </span>
              )}
            </span>
          )}
          {deck.length > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs font-medium text-muted-foreground">on deck</span>
              {deck.map((id, i) => (
                <span
                  key={`${arrived}-${id}`}
                  className="text-base font-medium animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards motion-reduce:animate-none"
                  style={{
                    animationDuration: `${ARRIVE_MS}ms`,
                    animationTimingFunction: EASE,
                    animationDelay: `${i * DECK_STAGGER_MS}ms`,
                  }}
                >
                  {name(id)}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The round summary (S7, section 10): the scores and next round's drawers, then both drawings
 * to look back at. The round result before it shows on the board (SB21). The next round starts
 * when everyone has tapped Continue, or when someone taps Start next round 10 s in.
 */
export function Intermission({
  view,
  me,
  seconds,
  sendMove,
}: {
  view: SketchBattleView;
  me: string;
  seconds: number | null;
  sendMove: (move: SketchBattleMove) => void;
}) {
  const stage = useHandoff();
  const [replays, setReplays] = useState<[number, number]>([0, 0]);
  const last = view.lastRound;
  const showdownNext = (last?.number ?? view.roundNumber) >= view.rounds;

  const lineup = (team: TeamIndex) => {
    const outgoing = last?.drawerIds[team] ?? view.teams[team].drawerId;
    // Nobody stays into the showdown (SB18): both pencils move on.
    const stays = !showdownNext && last?.winnerTeam === team;
    return outgoing ? lineupFor(view.teams[team], outgoing, stays) : null;
  };
  const ready = new Set(view.ready);
  const player = view.me.team !== null;
  const iAmReady = view.me.team !== null && ready.has(me);
  const short = view.waitingFor;
  /** Once ready, a player can skip the ones who aren't, 10 s into the summary. */
  const canForce = iAmReady && view.phase === "summary" && (seconds === null || seconds === 0);

  const actions = !player ? null : short.length > 0 ? (
    <div className="flex w-full flex-col items-center gap-2">
      <Cta disabled>Waiting for {short.map((t) => TEAM_NAME[t]).join(" and ")}</Cta>
      <p className="text-sm text-muted-foreground">Each team needs 2 players here</p>
    </div>
  ) : (
    <div className="flex w-full flex-col items-center gap-2">
      {iAmReady ? (
        <Cta disabled>
          <CheckIcon className="size-5" /> Ready
        </Cta>
      ) : (
        <Cta onClick={() => sendMove({ type: "ready" })}>Continue</Cta>
      )}
      {canForce && (
        <Cta variant="outline" onClick={() => sendMove({ type: "forceStart" })}>
          {showdownNext ? "Start the showdown" : "Start next round"}
        </Cta>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 @container">
      <Frame action={actions}>
        <p className="font-heading text-2xl font-bold">
          {showdownNext ? "showdown next" : `round ${(last?.number ?? view.roundNumber) + 1}`}
        </p>
        <div className="grid w-full max-w-md grid-cols-2 gap-6">
          {([0, 1] as const).map((t) => (
            <TeamLineup
              key={t}
              team={view.teams[t]}
              index={t}
              lineup={lineup(t)}
              stage={stage}
              ready={ready}
              badge={drawerBadge(view, t)}
            />
          ))}
        </div>
      </Frame>

      <div className="grid grid-cols-1 gap-6 border-t border-border/60 pt-6 pb-2 @2xl:grid-cols-2">
        {([0, 1] as const).map((t) => {
          const team = view.teams[t];
          const drawer = team.players.find((p) => p.id === last?.drawerIds[t])?.name ?? "Drawer";
          const won = last?.winnerTeam === t;
          return (
            <div key={t} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-1.5" style={{ color: TEAM_ACCENT[t] }}>
                  <PencilIcon className="size-4" aria-hidden />
                  {drawer}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={() => setReplays((r) => (t === 0 ? [r[0] + 1, r[1]] : [r[0], r[1] + 1]))}
                >
                  <RotateCcwIcon className="size-3.5" /> Replay
                </Button>
              </div>
              <ReplayCanvas
                ops={team.canvas.kind === "strokes" ? team.canvas.ops : []}
                label={`${TEAM_NAME[t]}'s drawing`}
                accent={won ? "var(--success)" : "var(--border)"}
                replayKey={replays[t]}
              />
              {/* Each team's guesses under its replay, as the original's summary (SB31). */}
              <Feed team={team} headers={[]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
