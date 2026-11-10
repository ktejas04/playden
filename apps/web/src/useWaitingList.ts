import type { AdminUser } from "@playden/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { listUsers } from "./api";
import { newArrivals } from "./waiting";

/** How often an admin's open app checks the waiting list. */
export const WAITING_CHECK_MS = 20_000;

/**
 * The waiting list for an admin, kept fresh while the app is open and visible.
 * `onArrivals` runs when new people show up after the first check.
 */
export function useWaitingList(enabled: boolean, onArrivals: (arrivals: AdminUser[]) => void) {
  const [count, setCount] = useState<number | null>(null);
  const known = useRef<Set<string> | null>(null);
  const onArrivalsRef = useRef(onArrivals);

  useEffect(() => {
    onArrivalsRef.current = onArrivals;
  }, [onArrivals]);

  const refresh = useCallback(async () => {
    try {
      const waiting = await listUsers("pending");
      const arrivals = newArrivals(known.current, waiting);
      known.current = new Set(waiting.map((user) => user.id));
      setCount(waiting.length);
      if (arrivals.length > 0) onArrivalsRef.current(arrivals);
    } catch {
      // A missed check is fine; the next one catches up.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, WAITING_CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  return { count: enabled ? count : null, refresh };
}
