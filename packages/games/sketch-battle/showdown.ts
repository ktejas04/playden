import { type GameEvent, type Transition, shuffle } from "@playden/engine";
import {
  SHOWDOWN_COUNTDOWN_SECONDS,
  SHOWDOWN_FINISH_BONUS,
  SHOWDOWN_HANDOFF_SECONDS,
  SHOWDOWN_INTRO_SECONDS,
  SHOWDOWN_RESULT_SECONDS,
  SHOWDOWN_WORD_POINTS,
} from "./config";
import { isCorrectGuess, rememberGuess } from "./guess";
import { EMPTY_CELLS } from "./preview";
import { nextConnected } from "./rotation";
import type {
  Pair,
  Phase,
  Showdown,
  ShowdownView,
  SketchBattleState,
  TeamIndex,
  TeamTurn,
} from "./types";

/**
 * The showdown (spec section 9): after the last round every round word comes back, and the
 * teams race through them in the same order, a new drawer for each word.
 */
type State = SketchBattleState;
const TEAMS: Pair<TeamIndex> = [0, 1];
const ms = (seconds: number) => seconds * 1000;

const SHOWDOWN_PHASES: readonly Phase[] = [
  "showdownIntro",
  "showdownCountdown",
  "showdown",
  "showdownResult",
];
export const inShowdown = (phase: Phase) => SHOWDOWN_PHASES.includes(phase);
/** Once the showdown is decided, every word and canvas can be shown. */
export const showdownOver = (phase: Phase) => phase === "showdownResult" || phase === "ended";

export function newTurn(drawerId: string, drawFrom: number): TeamTurn {
  return { drawerId, drawFrom, ops: [], cells: EMPTY_CELLS, guesses: [], solvedAt: null };
}

/**
 * After the last round's summary: the words in one seeded order, and each team's pencil
 * passes on from its last-round drawer. No winner stays in the showdown: every word gets
 * the team's next connected player (SB18).
 */
export function startShowdown(state: State, now: number, gone: Set<string>): Transition<State> {
  const shuffled = shuffle(
    state.rng,
    state.history.map((record) => record.word),
  );
  const last = state.history.at(-1);
  // A first guess estimate; play sets the real start when the countdown ends.
  const startsAt = now + ms(SHOWDOWN_INTRO_SECONDS + SHOWDOWN_COUNTDOWN_SECONDS);
  const turns = TEAMS.map((team) => {
    const rotation = state.rotations[team];
    const previous = last?.drawerIds[team] ?? rotation[0] ?? "";
    return newTurn(nextConnected(rotation, previous, gone), startsAt);
  }) as Pair<TeamTurn>;
  const showdown: Showdown = {
    words: shuffled.value,
    done: [0, 0],
    turns,
    winnerTeam: null,
    finishedAt: null,
  };
  return {
    state: {
      ...state,
      rng: shuffled.rng,
      phase: "showdownIntro",
      phaseEndsAt: now + ms(SHOWDOWN_INTRO_SECONDS),
      showdown,
    },
    events: [],
  };
}

/** The deadlines: intro → 3-2-1 → play (no timer) → result → the end. */
export function showdownDeadline(state: State, now: number): Transition<State> {
  const showdown = state.showdown;
  if (!showdown) return { state, events: [] };
  switch (state.phase) {
    case "showdownIntro":
      return {
        state: {
          ...state,
          phase: "showdownCountdown",
          phaseEndsAt: now + ms(SHOWDOWN_COUNTDOWN_SECONDS),
        },
        events: [],
      };
    case "showdownCountdown": {
      const turns = showdown.turns.map((turn) => ({ ...turn, drawFrom: now })) as Pair<TeamTurn>;
      return {
        state: { ...state, phase: "showdown", phaseEndsAt: null, showdown: { ...showdown, turns } },
        events: [{ type: "showdown.started" }],
      };
    }
    case "showdownResult":
      return {
        state: { ...state, phase: "ended", phaseEndsAt: null },
        events: [{ type: "game.ended", data: { scores: state.scores } }],
      };
    default:
      return { state, events: [] };
  }
}

/**
 * A guess on the team's current word. Right: 100 points, then the pencil passes to the next
 * connected player after a 2 s handoff; the last word also earns the finish bonus and ends
 * the showdown. Wrong guesses are live (D55).
 */
export function showdownGuess(
  state: State,
  playerId: string,
  team: TeamIndex,
  text: string,
  now: number,
  gone: Set<string>,
): Transition<State> {
  const showdown = state.showdown;
  if (!showdown) return { state, events: [] };
  const turn = showdown.turns[team];
  const word = showdown.words[showdown.done[team]] ?? "";
  const correct = isCorrectGuess(text, word);
  const recentGuesses = {
    ...state.recentGuesses,
    [playerId]: rememberGuess(state.recentGuesses[playerId] ?? [], now),
  };
  const guesses = [...turn.guesses, { by: playerId, text: text.trim(), at: now, correct }];
  const withTeam = (next: Showdown, value: TeamTurn): Showdown => ({
    ...next,
    turns: team === 0 ? [value, next.turns[1]] : [next.turns[0], value],
  });

  if (!correct) {
    return {
      state: { ...state, recentGuesses, showdown: withTeam(showdown, { ...turn, guesses }) },
      events: [],
      live: true,
    };
  }

  const done: Pair<number> =
    team === 0
      ? [showdown.done[0] + 1, showdown.done[1]]
      : [showdown.done[0], showdown.done[1] + 1];
  const finished = done[team] >= showdown.words.length;
  const points = SHOWDOWN_WORD_POINTS + (finished ? SHOWDOWN_FINISH_BONUS : 0);
  const scores: Pair<number> =
    team === 0
      ? [state.scores[0] + points, state.scores[1]]
      : [state.scores[0], state.scores[1] + points];
  const events: GameEvent[] = [{ type: "showdown.wordDone", data: { team, by: playerId } }];

  if (finished) {
    const next = withTeam(
      { ...showdown, done, winnerTeam: team, finishedAt: now },
      {
        ...turn,
        guesses,
        solvedAt: now,
      },
    );
    return {
      state: {
        ...state,
        recentGuesses,
        scores,
        showdown: next,
        phase: "showdownResult",
        phaseEndsAt: now + ms(SHOWDOWN_RESULT_SECONDS),
      },
      events,
    };
  }

  const drawer = nextConnected(state.rotations[team], turn.drawerId, gone);
  const handoff = newTurn(drawer, now + ms(SHOWDOWN_HANDOFF_SECONDS));
  events.push({ type: "drawer.handoff", data: { team, drawerId: drawer } });
  return {
    state: { ...state, recentGuesses, scores, showdown: withTeam({ ...showdown, done }, handoff) },
    events,
  };
}

/**
 * The showdown as one viewer may see it. Both teams race through the same words, so a team
 * never sees a word it hasn't reached: only its drawer sees its current word, and the other
 * team's words stay hidden until the end. Spectators see everything.
 */
export function showdownView(
  state: State,
  viewerTeam: TeamIndex | null,
  isDrawer: boolean,
): ShowdownView | null {
  const showdown = state.showdown;
  if (!showdown) return null;
  const over = showdownOver(state.phase);
  const started = state.phase !== "showdownIntro";
  const word = (team: TeamIndex) => showdown.words[showdown.done[team]] ?? null;
  const ownTeam = (team: TeamIndex) => viewerTeam === null || viewerTeam === team;
  return {
    total: showdown.words.length,
    done: showdown.done,
    finished: TEAMS.map((team) =>
      over || ownTeam(team) ? showdown.words.slice(0, showdown.done[team]) : null,
    ) as Pair<string[] | null>,
    current: TEAMS.map((team) =>
      over || viewerTeam === null || (viewerTeam === team && isDrawer && started)
        ? word(team)
        : null,
    ) as Pair<string | null>,
    winnerTeam: showdown.winnerTeam,
  };
}
