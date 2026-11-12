import type { GameDefinition, GameEvent, Transition } from "@playden/engine";
import { z } from "zod";
import { DEFAULT_CONFIG, TEAM_COUNT, configSchema } from "./config";
import type {
  Standing,
  TapRaceConfig,
  TapRaceEnding,
  TapRaceMove,
  TapRaceState,
  TapRaceView,
} from "./types";

function winnerOf(counts: number[]): number | null {
  const best = Math.max(...counts);
  const leaders = counts.flatMap((count, team) => (count === best ? [team] : []));
  return leaders.length === 1 ? (leaders[0] ?? null) : null;
}

function end(state: TapRaceState, events: GameEvent[]): Transition<TapRaceState> {
  const ending: TapRaceEnding = { winningTeam: winnerOf(state.counts), counts: state.counts };
  return { state: { ...state, ended: ending }, events };
}

function standing(own: number, other: number): Standing {
  return own > other ? "ahead" : own < other ? "behind" : "level";
}

export const tapRace: GameDefinition<TapRaceState, TapRaceMove, TapRaceView, TapRaceConfig> = {
  id: "tap-race",
  name: "Tap Race",
  summary: "Two teams race to tap first. A test game for local development.",
  minPlayers: 2,
  maxPlayers: 16,
  teams: { count: TEAM_COUNT, minSize: 1, maxSize: 8, maxSizeGap: 2 },
  devOnly: true,

  defaultConfig: DEFAULT_CONFIG,
  configSchema,
  moveSchema: z.strictObject({ type: z.literal("tap") }),

  setup: (seats, config, _seed, now) => {
    const teamOf: Record<string, number> = {};
    for (const seat of seats) {
      if (seat.team === undefined) throw new Error(`Tap Race needs a team for ${seat.id}`);
      teamOf[seat.id] = seat.team;
    }
    return {
      teamOf,
      counts: Array.from({ length: TEAM_COUNT }, () => 0),
      target: config.targetTaps,
      endsAt: now + config.roundSeconds * 1000,
      ended: null,
    };
  },

  validate: (state, playerId) => {
    if (state.ended) return { ok: false, reason: "The race is over" };
    if (state.teamOf[playerId] === undefined)
      return { ok: false, reason: "You're watching this race" };
    return { ok: true };
  },

  apply: (state, playerId) => {
    const team = state.teamOf[playerId] ?? 0;
    const counts = state.counts.map((count, i) => (i === team ? count + 1 : count));
    const next = { ...state, counts };
    if ((counts[team] ?? 0) >= state.target) return end(next, [{ type: "won", data: { team } }]);
    return { state: next, events: [] };
  },

  view: (state, viewer) => {
    const common = { target: state.target, endsAt: state.endsAt, ended: state.ended };
    const team = viewer === "spectator" ? undefined : state.teamOf[viewer];
    if (team === undefined) return { role: "spectator", counts: state.counts, ...common };
    const own = state.counts[team] ?? 0;
    const other = state.counts.reduce((sum, count, i) => (i === team ? sum : sum + count), 0);
    return { role: "player", team, ownCount: own, standing: standing(own, other), ...common };
  },

  nextDeadline: (state) => (state.ended ? null : state.endsAt),

  onDeadline: (state) => end(state, [{ type: "timeUp" }]),

  onPlayerLeft: (state, playerId) => ({ state, events: [{ type: "left", data: { playerId } }] }),

  /** Scores so far, for a game the host ends early: each player's team count. */
  standings: (state) =>
    Object.fromEntries(
      Object.entries(state.teamOf).map(([id, team]) => [id, state.counts[team] ?? 0]),
    ),

  result: (state) => {
    if (!state.ended) return null;
    const players = Object.entries(state.teamOf);
    const { winningTeam } = state.ended;
    return {
      scores: Object.fromEntries(players.map(([id, team]) => [id, state.counts[team] ?? 0])),
      winners: players.filter(([, team]) => team === winningTeam).map(([id]) => id),
    };
  },
};
