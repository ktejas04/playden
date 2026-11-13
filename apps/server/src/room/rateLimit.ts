/**
 * A token bucket: up to `burst` actions at once, refilling at `perSecond`. Pure; the room
 * keeps one bucket per connection for game moves, so an auto-clicker can't flood a room
 * (every message is billed) while normal fast play never notices.
 */
export interface Bucket {
  tokens: number;
  at: number;
}

export function takeToken(
  bucket: Bucket | undefined,
  now: number,
  { perSecond, burst }: { perSecond: number; burst: number },
): { ok: boolean; bucket: Bucket } {
  const start = bucket ?? { tokens: burst, at: now };
  const refilled = Math.min(burst, start.tokens + ((now - start.at) / 1000) * perSecond);
  if (refilled < 1) return { ok: false, bucket: { tokens: refilled, at: now } };
  return { ok: true, bucket: { tokens: refilled - 1, at: now } };
}
