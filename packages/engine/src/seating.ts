import type { AnyGame, Seat, TeamRules } from "./GameDefinition";

/** What decides who can sit at a game: its player counts and team rules. */
export type SeatRules = Pick<AnyGame, "minPlayers" | "maxPlayers" | "teams">;

/** Players per team, by team index. */
export function teamSizes(teams: TeamRules, seats: readonly Seat[]): number[] {
  const sizes = Array.from({ length: teams.count }, () => 0);
  for (const seat of seats) {
    if (seat.team !== undefined && seat.team < teams.count) {
      sizes[seat.team] = (sizes[seat.team] ?? 0) + 1;
    }
  }
  return sizes;
}

/** The team a newcomer joins: the smallest one with room, the first on a tie; null when all are full. */
export function teamForNewcomer(teams: TeamRules, seats: readonly Seat[]): number | null {
  let best: { team: number; size: number } | null = null;
  for (const [team, size] of teamSizes(teams, seats).entries()) {
    if (size < teams.maxSize && (best === null || size < best.size)) best = { team, size };
  }
  return best?.team ?? null;
}

/** The seat a newcomer would get, or null when the game is full. */
export function seatForNewcomer(
  rules: SeatRules,
  seats: readonly Seat[],
  person: { id: string; name: string },
): Seat | null {
  if (seats.length >= rules.maxPlayers) return null;
  if (!rules.teams) return { id: person.id, name: person.name };
  const team = teamForNewcomer(rules.teams, seats);
  return team === null ? null : { id: person.id, name: person.name, team };
}

/**
 * Seats people in order as if each joined in turn, e.g. after the host switches to a game
 * with other rules. Whoever doesn't fit is returned as overflow, last to join first out.
 */
export function seatInOrder(
  rules: SeatRules,
  people: readonly { id: string; name: string }[],
): { seats: Seat[]; overflow: string[] } {
  const seats: Seat[] = [];
  const overflow: string[] = [];
  for (const person of people) {
    const seat = seatForNewcomer(rules, seats, person);
    if (seat) seats.push(seat);
    else overflow.push(person.id);
  }
  return { seats, overflow };
}

/** Why these seats can't start the game yet, in words for the Start button; null when they can. */
export function seatProblem(rules: SeatRules, seats: readonly Seat[]): string | null {
  const missing = rules.minPlayers - seats.length;
  if (missing > 0) return `Need ${missing} more`;
  if (seats.length > rules.maxPlayers) return `At most ${rules.maxPlayers} players`;
  if (!rules.teams) return null;
  const { minSize, maxSize, maxSizeGap } = rules.teams;
  const sizes = teamSizes(rules.teams, seats);
  for (const [team, size] of sizes.entries()) {
    if (size < minSize) return `Team ${team + 1} needs ${minSize - size} more`;
    if (size > maxSize) return `Team ${team + 1} is over ${maxSize}`;
  }
  if (Math.max(...sizes) - Math.min(...sizes) > maxSizeGap) return "Teams are uneven";
  return null;
}
