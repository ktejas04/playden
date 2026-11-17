import { formatGap, gapMs } from "../scoring";
import type { RoundRecord, TeamIndex } from "../types";
import { TEAM_NAME } from "./palette";

export type Tone = "won" | "lost" | "neutral";

/**
 * The words on the round result (S7): for one team's players, for spectators overall
 * (`team` null), or for spectators on one team's canvas (`who` names the team, SB20).
 */
export function resultText(
  round: RoundRecord,
  team: TeamIndex | null,
  who?: string,
): { title: string; detail: string; tone: Tone } {
  const gap = gapMs(round.solvedAt, round.drawingStartedAt);
  const theWord = `The word was ${round.word}`;
  if (team === null) {
    if (round.winnerTeam === null) return { title: "Time's up!", detail: theWord, tone: "neutral" };
    return { title: `${TEAM_NAME[round.winnerTeam]} won`, detail: theWord, tone: "neutral" };
  }
  const points = round.points[team];
  if (round.winnerTeam === team) {
    return {
      title: who ? `${who} wins!` : "You win!",
      detail: `+${points} points`,
      tone: "won",
    };
  }
  if (points > 0) {
    return {
      title: `${who ?? "You"} lost by ${formatGap(gap ?? 0)}`,
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
