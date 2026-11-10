import { type Me, meSchema } from "@playden/protocol";

const KEY = "playden:me";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

/**
 * The last known account, kept on this device so screens draw at once on the next visit
 * while the server check runs. The server still decides what the person may do.
 */
export function readCachedMe(storage: Storage): Me | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const parsed = meSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeCachedMe(storage: Storage, me: Me | null): void {
  try {
    if (me) storage.setItem(KEY, JSON.stringify(me));
    else storage.removeItem(KEY);
  } catch {
    // Storage blocked (e.g. a private window); the app works without the cache.
  }
}
