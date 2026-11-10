export const SESSION_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** A room with nobody in it (or nobody ever joined) closes after this long. */
export const ROOM_EMPTY_CLOSE_MS = 60_000;
/** Random codes tried before giving up when creating a room. */
export const ROOM_CODE_ATTEMPTS = 5;
