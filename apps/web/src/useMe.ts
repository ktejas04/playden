import type { Me } from "@playden/protocol";
import { useCallback, useEffect, useState } from "react";
import { fetchMe } from "./api";
import { readCachedMe, writeCachedMe } from "./meCache";

export type MeState =
  { status: "loading" } | { status: "error"; message: string } | { status: "ready"; me: Me | null };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function initialState(): MeState {
  const store = storage();
  const cached = store ? readCachedMe(store) : null;
  return cached ? { status: "ready", me: cached } : { status: "loading" };
}

/**
 * The signed-in account. A returning visitor sees their last known account at once
 * (no "Loading…"), and the server's answer replaces it a moment later.
 */
export function useMe() {
  const [state, setState] = useState<MeState>(initialState);

  const setMe = useCallback((me: Me | null) => {
    const store = storage();
    if (store) writeCachedMe(store, me);
    setState({ status: "ready", me });
  }, []);

  const reload = useCallback(async () => {
    try {
      setMe(await fetchMe());
    } catch (error) {
      // With a cached account on screen, a failed check keeps it rather than an error page.
      setState((current) =>
        current.status === "ready" && current.me
          ? current
          : {
              status: "error",
              message: error instanceof Error ? error.message : "Something went wrong",
            },
      );
    }
  }, [setMe]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload, setMe };
}
