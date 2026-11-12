export const SESSION_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** A room with nobody in it (or nobody ever joined) closes after this long. */
export const ROOM_EMPTY_CLOSE_MS = 60_000;

/** The close delay, or the `ROOM_EMPTY_CLOSE_MS` env override (set in .dev.vars to test it quickly). */
export function roomEmptyCloseMs(override: string | undefined): number {
  const ms = Number(override);
  return Number.isInteger(ms) && ms > 0 ? ms : ROOM_EMPTY_CLOSE_MS;
}
/**
 * How long someone whose connection dropped stays in the room as "away" before they count as
 * gone (host passes on, a setup seat is freed). A player mid-game keeps their seat regardless.
 */
export const AWAY_GRACE_MS = 60_000;
/** How long a declined person waits before they can ask again. 5 s while testing; raise before launch (e.g. 1 hour). */
export const ASK_AGAIN_AFTER_MS = 5_000;
/** Random codes tried before giving up when creating a room. */
export const ROOM_CODE_ATTEMPTS = 5;
