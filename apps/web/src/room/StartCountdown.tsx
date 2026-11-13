import { useEffect, useState } from "react";
import { Panel } from "../Shell";

function secondsLeft(startsAt: number | null, now: number): number {
  return startsAt === null ? 0 : Math.max(0, Math.ceil((startsAt - now) / 1000));
}

/** Whole seconds left until `startsAt` on the server's clock, ticking; 0 once play has begun. */
export function useSecondsUntil(startsAt: number | null, serverNow: () => number): number {
  const [seconds, setSeconds] = useState(() => secondsLeft(startsAt, serverNow()));
  useEffect(() => {
    setSeconds(secondsLeft(startsAt, serverNow()));
    if (startsAt === null) return;
    const timer = setInterval(() => {
      const next = secondsLeft(startsAt, serverNow());
      setSeconds(next);
      if (next === 0) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [startsAt, serverNow]);
  return seconds;
}

/** The 3-2-1 every screen shows between Start and play, counted on the server's clock. */
export function StartCountdown({ seconds }: { seconds: number }) {
  return (
    <Panel className="mt-4">
      <div className="flex flex-col items-center gap-2 py-12 text-center" aria-live="assertive">
        <p className="text-sm font-medium text-muted-foreground">Get ready</p>
        <p
          key={seconds}
          className="font-heading text-8xl font-bold tabular-nums duration-500 animate-in fade-in-0 zoom-in-50"
        >
          {seconds}
        </p>
      </div>
    </Panel>
  );
}
