/**
 * A move this device sent, shown faded until the server confirms it (D55): the client never
 * assumes a move worked. `after` is how many confirmed items existed when it was sent, so it
 * only matches something confirmed later.
 */
export interface Pending<T> {
  id: number;
  item: T;
  sentAt: number;
  after: number;
}

export function addPending<T>(
  pending: readonly Pending<T>[],
  item: T,
  { confirmedCount, now }: { confirmedCount: number; now: number },
): Pending<T>[] {
  const id = (pending.at(-1)?.id ?? 0) + 1;
  return [...pending, { id, item, sentAt: now, after: confirmedCount }];
}

/**
 * Drops pending items the server has now confirmed (each confirmed item settles at most one)
 * and those older than `timeoutMs`, which were refused or lost.
 */
export function settlePending<T, C>(
  pending: readonly Pending<T>[],
  confirmed: readonly C[],
  matches: (item: T, confirmed: C) => boolean,
  { now, timeoutMs }: { now: number; timeoutMs: number },
): Pending<T>[] {
  const used = new Set<number>();
  return pending.filter((p) => {
    if (now - p.sentAt >= timeoutMs) return false;
    for (let i = p.after; i < confirmed.length; i++) {
      const c = confirmed[i] as C;
      if (!used.has(i) && matches(p.item, c)) {
        used.add(i);
        return false;
      }
    }
    return true;
  });
}
