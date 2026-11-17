import { useEffect, useState } from "react";

/** Server time, refreshed a few times a second, for countdowns (D9: the server's clock decides). */
export function useNow(serverNow: () => number, everyMs = 250): number {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), everyMs);
    return () => clearInterval(timer);
  }, [serverNow, everyMs]);
  return now;
}
