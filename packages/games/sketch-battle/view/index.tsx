import type { GameViewProps } from "@playden/engine";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@playden/ui/components/tabs";
import { type Pending, addPending, settlePending } from "@playden/ui/lib/pending";
import { PencilIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type {
  DrawStart,
  Guess,
  SketchBattleMove,
  SketchBattleView,
  TeamIndex,
  TeamView,
} from "../types";
import { Canvas } from "./Canvas";
import { showsToolbar } from "./drawerTools";
import { AttemptTracker, Feed } from "./Feed";
import { GuessBox } from "./GuessBox";
import { Intermission } from "./Intermission";
import { OpponentStrip } from "./OpponentStrip";
import { ChooseOverlay, CountdownOverlay, NoteOverlay, ResultOverlay } from "./Overlays";
import { TEAM_ACCENT, TEAM_NAME } from "./palette";
import { ShowdownIntro, ShowdownResult, WordHistory, WordTrack } from "./Showdown";
import { StatusBar } from "./StatusBar";
import { Toolbar } from "./Toolbar";
import { resultText } from "./result";
import { phaseLength, secondsLeft } from "./timer";
import { useNow } from "./useNow";

/** How long a guess shows faded before we give up on hearing it back. */
const PENDING_TIMEOUT_MS = 5_000;
const FIRST_TOOL: DrawStart = { tool: "pen", colour: 0, size: 1 };

type Props = GameViewProps<SketchBattleView, SketchBattleMove>;

const otherTeam = (team: TeamIndex): TeamIndex => (team === 0 ? 1 : 0);

/** Whether this viewer picked this round's word. */
function isChooser(view: SketchBattleView): boolean {
  const mine = view.me.team === null ? null : view.teams[view.me.team];
  return view.me.role === "drawer" && mine?.drawerId === view.chooserId;
}

/** What goes over a team's canvas right now: choose words, 3-2-1, a team's win, or the result. */
function CanvasOverlay({
  view,
  team,
  viewerTeam,
  seconds,
  sendMove,
}: {
  view: SketchBattleView;
  team: TeamIndex;
  viewerTeam: TeamIndex | null;
  seconds: number | null;
  sendMove?: (move: SketchBattleMove) => void;
}) {
  if (view.phase === "choose" && sendMove) {
    return <ChooseOverlay view={view} seconds={seconds} sendMove={sendMove} />;
  }
  // Players see their own result, spectators each team's on its canvas (SB20, SB21).
  if (view.phase === "result" && view.lastRound && (viewerTeam === null || viewerTeam === team)) {
    const who = viewerTeam === null ? TEAM_NAME[team] : undefined;
    const result = resultText(view.lastRound, team, who);
    return <ResultOverlay title={result.title} detail={result.detail} tone={result.tone} />;
  }
  // Drawers and spectators see the pick through the 3-2-1; guessers get the big count.
  if (view.phase === "countdown" && view.choices && sendMove) {
    return <ChooseOverlay view={view} seconds={seconds} sendMove={sendMove} />;
  }
  const counting = view.phase === "countdown" || view.phase === "showdownCountdown";
  if (counting && seconds !== null) return <CountdownOverlay seconds={seconds} />;
  if (view.phase === "drawing") {
    if (viewerTeam !== null && viewerTeam === team) {
      const mine = view.teams[viewerTeam];
      if (mine.solvedAt !== null) {
        const other = viewerTeam === 0 ? 1 : 0;
        return (
          <ResultOverlay
            title="you win!"
            detail={`waiting for ${TEAM_NAME[other].toLowerCase()}...`}
            tone="won"
            showTrophy
          />
        );
      }
    } else if (viewerTeam === null) {
      // Spectator view
      const target = view.teams[team];
      if (target.solvedAt !== null) {
        const other = team === 0 ? 1 : 0;
        return (
          <ResultOverlay
            title={`${TEAM_NAME[team]} got it!`}
            detail={`waiting for ${TEAM_NAME[other].toLowerCase()}...`}
            tone="won"
            showTrophy
          />
        );
      }
    }
  }
  return null;
}

/** The canvas border: neutral, turning green once the team guesses. */
function borderFor(view: SketchBattleView, team: TeamIndex, viewerTeam: TeamIndex | null): string {
  if (view.teams[team].solvedAt !== null && (viewerTeam === null || viewerTeam === team)) {
    return "var(--success)";
  }
  return "var(--border)";
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
  sendMove,
  note,
}: {
  view: SketchBattleView;
  team: TeamIndex;
  viewerTeam: TeamIndex | null;
  seconds: number | null;
  tools?: React.ComponentProps<typeof Canvas>["tools"];
  sendMove?: (move: SketchBattleMove) => void;
  /** A short message over the canvas, e.g. the showdown's pencil handoff. */
  note?: string | null;
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
      {note ? (
        <NoteOverlay>{note}</NoteOverlay>
      ) : (
        <CanvasOverlay
          view={view}
          team={team}
          viewerTeam={viewerTeam}
          seconds={seconds}
          sendMove={sendMove}
        />
      )}
    </Canvas>
  );
}

/** A player's round: their team's canvas, their tools or guess box, their feed, and opponent box. */
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
  // A new drawer means a new word: guesses still on their way belong to the last one.
  useEffect(() => setPending([]), [mine.drawerId]);
  const isDrawer = view.me.role === "drawer";
  const racing = view.showdown !== null && view.phase !== "ended";
  /** The challenger draws alone through the head start; everyone else sees a blank canvas (S4). */
  const myHeadStart = view.phase === "headStart" && isChooser(view);
  const drawing = view.phase === "drawing" || view.phase === "showdown" || myHeadStart;
  /** In the showdown, the 2 s while the pencil passes to the next drawer. */
  const handingOff = view.phase === "showdown" && now < (mine.drawFrom ?? 0);
  const drawerName = mine.players.find((p) => p.id === mine.drawerId)?.name ?? "Someone";
  const handoffNote = handingOff
    ? isDrawer
      ? "got it! your turn to draw"
      : `got it! ${drawerName} draws next`
    : null;
  /** The local timer hasn't hit 0: guessing closes then, without waiting for the round end. */
  const timeLeft = seconds === null || seconds > 0;
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

  const main = (
    <div className="flex min-w-0 flex-col gap-2">
      <TeamCanvas
        view={view}
        team={team}
        viewerTeam={team}
        seconds={seconds}
        tools={canDraw ? { start: tool, sendMove, serverNow } : null}
        sendMove={sendMove}
        note={handoffNote}
      />
      <AttemptTracker team={mine} />
      {isDrawer ? (
        showsToolbar(view) ? (
          <Toolbar
            tool={tool}
            onChange={setTool}
            onClear={canDraw ? () => sendMove({ type: "clear" }) : undefined}
          />
        ) : null
      ) : (
        (drawing ||
          view.phase === "countdown" ||
          view.phase === "headStart" ||
          view.phase === "showdownCountdown") && (
          <div className="sticky bottom-0 z-10 -mx-1 bg-card px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            <GuessBox
              open={drawing && timeLeft && !handingOff}
              closedHint={
                handingOff ? "Next word coming" : drawing ? "Time's up" : "Get ready to guess"
              }
              solved={mine.solvedAt !== null}
              now={serverNow}
              onGuess={guess}
            />
          </div>
        )
      )}
      <Feed team={mine} pending={shownPending} myName={myName} className="mt-2" />
    </div>
  );

  return (
    // Laid out by the board's own width, not the window's: a narrow page never squeezes it.
    <div className="@container">
      <div className="flex flex-col gap-6 @3xl:grid @3xl:grid-cols-[1fr_280px] @3xl:gap-8">
        {main}
        <div className="border-t border-border/60 pt-4 @3xl:border-t-0 @3xl:border-l @3xl:border-border @3xl:pt-0 @3xl:pl-6">
          {/* The showdown has no opponent canvas (SB4): the team's own words go there (SB27). */}
          {racing ? (
            <WordHistory view={view} />
          ) : (
            <OpponentStrip team={view.teams[otherTeam(team)]} index={otherTeam(team)} />
          )}
        </div>
      </div>
    </div>
  );
}

/** Spectator view: both teams' drawings and guesses */
function SpectatorBoard({
  view,
  seconds,
  sendMove,
}: {
  view: SketchBattleView;
  seconds: number | null;
  sendMove: (move: SketchBattleMove) => void;
}) {
  const current = view.phase === "showdown" ? view.showdown?.current : null;
  const drawerOf = (team: TeamIndex) =>
    view.teams[team].players.find((p) => p.id === view.teams[team].drawerId)?.name;
  const side = (team: TeamIndex) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
        {/* On a phone the tabs already name the team. */}
        <span
          className="hidden items-center gap-1.5 @2xl:flex"
          style={{ color: TEAM_ACCENT[team] }}
        >
          <span className="size-2.5 rounded-full" style={{ background: TEAM_ACCENT[team] }} />
          {TEAM_NAME[team]}
        </span>
        {drawerOf(team) && (
          <span className="ml-auto flex min-w-0 items-center gap-1 text-foreground">
            <PencilIcon className="size-4 shrink-0" style={{ color: TEAM_ACCENT[team] }} />
            <span className="truncate">{drawerOf(team)}</span>
          </span>
        )}
      </div>
      {current && (
        <p className="font-heading text-lg font-bold" style={{ color: TEAM_ACCENT[team] }}>
          {current[team] ?? ""}
        </p>
      )}
      <TeamCanvas view={view} team={team} viewerTeam={null} seconds={seconds} sendMove={sendMove} />
      <AttemptTracker team={view.teams[team]} />
      <Feed team={view.teams[team]} />
    </div>
  );
  const board = (
    <>
      <Tabs defaultValue="0" className="@2xl:hidden">
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
      <div className="hidden gap-8 @2xl:grid @2xl:grid-cols-2">
        {side(0)}
        {side(1)}
      </div>
    </>
  );
  if (!view.showdown) return <div className="@container">{board}</div>;
  // The showdown adds the word track (SB22): beside the canvases on a wide board, below otherwise.
  return (
    <div className="@container">
      <div className="flex flex-col gap-6 @4xl:flex-row">
        <div className="min-w-0 flex-1">{board}</div>
        <aside className="border-t border-border/60 pt-4 @4xl:w-52 @4xl:shrink-0 @4xl:border-t-0 @4xl:border-l @4xl:border-border @4xl:pt-0 @4xl:pl-6">
          <WordTrack showdown={view.showdown} />
        </aside>
      </div>
    </div>
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

export { SketchBattleSettings } from "./settings";

export function SketchBattleScreen(props: Props) {
  const { view, me, sendMove, serverNow } = props;
  const now = useNow(serverNow);
  const seconds = secondsLeft(view.phaseEndsAt, serverNow(), phaseLength(view));

  if (view.phase === "ended") return <FinalScores view={view} />;
  if (view.phase === "showdownIntro") return <ShowdownIntro view={view} seconds={seconds} />;
  if (view.phase === "showdownResult") return <ShowdownResult view={view} />;
  // The round result stays on the board for everyone (SB21); the summary is its own screen.
  if (view.phase === "summary") {
    return (
      <Intermission
        key={view.lastRound?.number}
        view={view}
        me={me}
        seconds={seconds}
        sendMove={sendMove}
      />
    );
  }

  return (
    <div className="-mx-2 flex flex-col gap-2 sm:mx-0">
      <StatusBar view={view} seconds={seconds} />
      {view.me.role === "spectator" ? (
        <SpectatorBoard view={view} seconds={seconds} sendMove={sendMove} />
      ) : (
        <PlayerBoard {...props} seconds={seconds} now={now} />
      )}
    </div>
  );
}
