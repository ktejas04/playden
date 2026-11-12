import { type GameSession, roleIn } from "@playden/protocol";

/**
 * Who is in a room (docs/design/rooms-and-games.md section 6). A member whose connection drops
 * is away, not gone: they stay listed for AWAY_GRACE_MS, and come back to the same place.
 * After that they're gone, unless they hold a seat in a running game, which waits for them
 * for the whole game. Leaving on purpose (Leave, removal) is gone at once. All pure.
 */
export interface Member {
  id: string;
  name: string;
  isAdmin: boolean;
  /** First arrival; seniority for host handover. Kept across reconnects. */
  joinedAt: number;
  /** When their connection dropped; null while connected. */
  awayAt: number | null;
}

export type Members = Record<string, Member>;

/** Someone connects: new members start now, returning ones keep their place. */
export function memberArrives(
  members: Members,
  person: { id: string; name: string; isAdmin: boolean },
  now: number,
): Members {
  const joinedAt = members[person.id]?.joinedAt ?? now;
  return { ...members, [person.id]: { ...person, joinedAt, awayAt: null } };
}

/** Their last connection dropped. */
export function memberAway(members: Members, id: string, now: number): Members {
  const member = members[id];
  if (!member || member.awayAt !== null) return members;
  return { ...members, [id]: { ...member, awayAt: now } };
}

export function memberGone(members: Members, id: string): Members {
  if (!(id in members)) return members;
  return Object.fromEntries(Object.entries(members).filter(([other]) => other !== id));
}

/** Longest in the room first. */
export function inOrder(members: Members): Member[] {
  return Object.values(members).sort((a, b) => a.joinedAt - b.joinedAt);
}

/** A running game keeps a player's seat however long they're away. */
function holdsSeat(session: GameSession | null, id: string): boolean {
  return session?.phase === "playing" && roleIn(session, id) === "player";
}

/** When an away member stops counting as in the room, unless a seat holds them. */
function expiresAt(member: Member, session: GameSession | null, graceMs: number): number | null {
  if (member.awayAt === null || holdsSeat(session, member.id)) return null;
  return member.awayAt + graceMs;
}

/** Away members whose grace has run out (and who hold no seat): they're gone now. */
export function expiredIds(
  members: Members,
  session: GameSession | null,
  now: number,
  graceMs: number,
): string[] {
  return inOrder(members).flatMap((member) => {
    const at = expiresAt(member, session, graceMs);
    return at !== null && at <= now ? [member.id] : [];
  });
}

/** The next time someone's grace runs out, for the room's alarm; null when nobody's will. */
export function nextExpiry(
  members: Members,
  session: GameSession | null,
  graceMs: number,
): number | null {
  const times = Object.values(members).flatMap((m) => {
    const at = expiresAt(m, session, graceMs);
    return at === null ? [] : [at];
  });
  return times.length === 0 ? null : Math.min(...times);
}

/** Away, but still within their grace: they still count as in the room. */
export function inGraceIds(members: Members, now: number, graceMs: number): string[] {
  return inOrder(members).flatMap((m) =>
    m.awayAt !== null && now - m.awayAt < graceMs ? [m.id] : [],
  );
}
