import type { GameViewProps } from "@playden/engine";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@playden/ui/components/tabs";
import { type Pending, addPending, settlePending } from "@playden/ui/lib/pending";
import { useCallback, useState } from "react";
import { CHOOSE_SECONDS } from "../config";
import type {
  DrawStart,
  Guess,
  SketchBattleMove,
  SketchBattleView,
  TeamIndex,
  TeamView,
} from "../types";
import { Canvas } from "./Canvas";
import { ChooseStage } from "./ChooseStage";
import { Feed } from "./Feed";
import { GuessBox } from "./GuessBox";
import { OpponentStrip } from "./OpponentStrip";
import { CountdownOverlay, NoteOverlay, ResultOverlay } from "./Overlays";
import { TEAM_ACCENT, TEAM_NAME } from "./palette";
import { resultText } from "./result";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import { secondsLeft, useNow } from "./useNow";

/** How long a guess shows faded before we give up on hearing it back. */
const PENDING_TIMEOUT_MS = 5_000;
const FIRST_TOOL: DrawStart = { tool: "pen", colour: 0, size: 1 };

type Props = GameViewProps<SketchBattleView, SketchBattleMove>;

const otherTeam = (team: TeamIndex): TeamIndex => (team === 0 ? 1 : 0);

function waitingNote(view: SketchBattleView): string {
  const names = view.waitingFor.map((t) => TEAM_NAME[t]).join(" and ");
  return `Waiting for ${names}: each team needs 2 players here to start the next round`;
}

/** What goes over a team's canvas right now: the 3-2-1, the result, or a wait. */
function CanvasOverlay({
  view,
  viewerTeam,
  seconds,
}: {
  view: SketchBattleView;
  viewerTeam: TeamIndex | null;
  seconds: number | null;
}) {
  if (view.phase === "countdown" && seconds !== null) return <CountdownOverlay seconds={seconds} />;
  if (view.phase === "waiting") return <NoteOverlay>{waitingNote(view)}</NoteOverlay>;
  if (view.phase === "result" && view.lastRound) {
    return <ResultOverlay {...resultText(view.lastRound, viewerTeam)} />;
  }
  return null;
}

/** The canvas border: the team's colour, or green or red at the round result. */
function borderFor(view: SketchBattleView, team: TeamIndex, viewerTeam: TeamIndex | null): string {
  if (
    (view.phase === "result" || view.phase === "waiting") &&
    view.lastRound &&
    viewerTeam === team
  ) {
    const { tone } = resultText(view.lastRound, viewerTeam);
    if (tone === "won") return "var(--success)";
    if (tone === "lost") return "var(--destructive)";
  }
  return TEAM_ACCENT[team];
}

/** A short ring that pulses once on the canvas when the team gets the word. */
function SolvedPulse({ solvedAt }: { solvedAt: number | null }) {
  if (solvedAt === null) return null;
  return (
    <span
      key={solvedAt}
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[10px] ring-[6px] ring-success ring-inset duration-500 animate-out fade-out-0 fill-mode-forwards"
    />
  );
}

function TeamCanvas({
  view,
  team,
  viewerTeam,
  seconds,
  tools,
}: {
  view: SketchBattleView;
  team: TeamIndex;
  viewerTeam: TeamIndex | null;
  seconds: number | null;
  tools?: React.ComponentProps<typeof Canvas>["tools"];
}) {
  const side: TeamView = view.teams[team];
  const ops = side.canvas.kind === "strokes" ? side.canvas.ops : [];
  return (
    <Canvas
      ops={ops}
      tools={tools}
      label={`${TEAM_NAME[team]}'s drawing`}
      accent={borderFor(view, team, viewerTeam)}
      className="transition-[border-color] duration-300"
    >
      <SolvedPulse solvedAt={side.solvedAt} />
      <CanvasOverlay view={view} viewerTeam={viewerTeam} seconds={seconds} />
    </Canvas>
  );
}

/** A player's round: their team's canvas, their tools or guess box, their feed, the other team. */
function PlayerBoard({
  view,
  me,
  sendMove,
  serverNow,
  seconds,
  now,
}: Props & { seconds: number | null; now: number }) {
  const team = view.me.team ?? 0;
  const mine = view.teams[team];
  const [tool, setTool] = useState<DrawStart>(FIRST_TOOL);
  const [pending, setPending] = useState<Pending<string>[]>([]);
  const isDrawer = view.me.role === "drawer";
  const drawing = view.phase === "drawing";
  const canDraw =
    isDrawer && drawing && mine.solvedAt === null && now >= (mine.drawFrom ?? Infinity);
  const myName = mine.players.find((p) => p.id === me)?.name;

  const confirmed: Guess[] = mine.guesses ?? [];
  const shownPending = settlePending(
    pending,
    confirmed,
    (text, g) => g.by === me && g.text === text,
    { now, timeoutMs: PENDING_TIMEOUT_MS },
  );

  const guess = useCallback(
    (text: string) => {
      setPending((list) =>
        addPending(list, text, { confirmedCount: confirmed.length, now: serverNow() }),
      );
      sendMove({ type: "guess", text });
    },
    [confirmed.length, sendMove, serverNow],
  );

  return (
    <div className="flex flex-col gap-3">
      <TeamCanvas
        view={view}
        team={team}
        viewerTeam={team}
        seconds={seconds}
        tools={canDraw ? { start: tool, sendMove, serverNow } : null}
      />
      {isDrawer ? (
        drawing && mine.solvedAt === null ? (
          <Toolbar tool={tool} onChange={setTool} onClear={() => sendMove({ type: "clear" })} />
        ) : drawing ? (
          <p className="rounded-xl bg-success/15 py-3 text-center font-heading text-lg font-bold text-success duration-300 animate-in fade-in-0">
            Your team got it!
          </p>
        ) : null
      ) : (
        (drawing || view.phase === "countdown") && (
          <div className="sticky bottom-0 z-10 -mx-1 bg-card px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <GuessBox
              open={drawing}
              solved={mine.solvedAt !== null}
              now={serverNow}
              onGuess={guess}
            />
          </div>
        )
      )}
      <section aria-label="Your team's guesses">
        <h3 className="mb-1 text-sm font-semibold text-muted-foreground">Your team</h3>
        <Feed team={mine} pending={shownPending} myName={myName} />
      </section>
      <OpponentStrip team={view.teams[otherTeam(team)]} index={otherTeam(team)} />
    </div>
  );
}

/** S12 (simple for now): both teams' drawings and guesses; tabs on a phone, side by side wider. */
function SpectatorBoard({ view, seconds }: { view: SketchBattleView; seconds: number | null }) {
  const side = (team: TeamIndex) => (
    <div className="flex flex-col gap-2">
      <TeamCanvas view={view} team={team} viewerTeam={null} seconds={seconds} />
      <Feed team={view.teams[team]} />
    </div>
  );
  return (
    <>
      <Tabs defaultValue="0" className="sm:hidden">
        <TabsList className="w-full">
          {([0, 1] as const).map((t) => (
            <TabsTrigger key={t} value={String(t)} className="flex-1">
              <span
                className="size-2.5 rounded-full"
                style={{ background: TEAM_ACCENT[t] }}
                aria-hidden
              />
              {TEAM_NAME[t]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="0">{side(0)}</TabsContent>
        <TabsContent value="1">{side(1)}</TabsContent>
      </Tabs>
      <div className="hidden gap-3 sm:grid sm:grid-cols-2">
        {side(0)}
        {side(1)}
      </div>
    </>
  );
}

function FinalScores({ view }: { view: SketchBattleView }) {
  return (
    <div className="flex items-center justify-center gap-4 py-6 font-heading text-3xl font-bold tabular-nums">
      {view.teams.map((team, i) => (
        <span key={i} className="flex flex-col items-center gap-1">
          <span className="text-sm font-medium" style={{ color: TEAM_ACCENT[i] }}>
            {TEAM_NAME[i]}
          </span>
          {team.score}
        </span>
      ))}
    </div>
  );
}

export function SketchBattleScreen(props: Props) {
  const { view, sendMove, serverNow } = props;
  const now = useNow(serverNow);
  const seconds = secondsLeft(view.phaseEndsAt, now);
  if (view.phase === "ended") return <FinalScores view={view} />;
  return (
    <div className="-mx-2 flex flex-col gap-4 sm:mx-0">
      <StatusBar view={view} seconds={seconds} />
      {view.phase === "choose" ? (
        <ChooseStage
          view={view}
          seconds={seconds ?? 0}
          total={CHOOSE_SECONDS}
          sendMove={sendMove}
        />
      ) : view.me.role === "spectator" ? (
        <SpectatorBoard view={view} seconds={seconds} />
      ) : (
        <PlayerBoard {...props} seconds={seconds} now={now} />
      )}
    </div>
  );
}
