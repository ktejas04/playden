import { formatGap, gapMs } from "../scoring";
import type { RoundRecord, TeamIndex } from "../types";
import { TEAM_NAME } from "./palette";

export type Tone = "won" | "lost" | "neutral";

/** The words on the round result overlay (S7), for one team's players or for spectators. */
export function resultText(
  round: RoundRecord,
  team: TeamIndex | null,
): { title: string; detail: string; tone: Tone } {
  const gap = gapMs(round.solvedAt, round.drawingStartedAt);
  const theWord = `The word was ${round.word}`;
  if (team === null) {
    if (round.winnerTeam === null) return { title: "Time's up!", detail: theWord, tone: "neutral" };
    const by = gap === null ? "" : ` by ${formatGap(gap)}`;
    return { title: `${TEAM_NAME[round.winnerTeam]} won${by}`, detail: theWord, tone: "neutral" };
  }
  const points = round.points[team];
  if (points > 0 && round.winnerTeam === team) {
    return {
      title: gap === null ? "You got it first!" : `You won by ${formatGap(gap)}!`,
      detail: `+${points} points`,
      tone: "won",
    };
  }
  if (points > 0) {
    return {
      title: `You lost by ${formatGap(gap ?? 0)}`,
      detail: `+${points} points`,
      tone: "lost",
    };
  }
  return {
    title: "Time's up!",
    detail: theWord,
    tone: round.winnerTeam === null ? "neutral" : "lost",
  };
}
