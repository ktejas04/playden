import type { Me } from "@playden/protocol";
import { useCallback, useEffect, useState } from "react";
import { fetchMe } from "./api";

export type MeState =
  { status: "loading" } | { status: "error"; message: string } | { status: "ready"; me: Me | null };

export function useMe() {
  const [state, setState] = useState<MeState>({ status: "loading" });

  const reload = useCallback(async () => {
    try {
      setState({ status: "ready", me: await fetchMe() });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Something went wrong",
      });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setMe = useCallback((me: Me | null) => setState({ status: "ready", me }), []);

  return { state, reload, setMe };
}
