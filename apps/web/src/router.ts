import { useEffect, useState } from "react";
import { roomCodeSchema } from "@playden/protocol";

export type Route =
  | { name: "home" }
  | { name: "room"; code: string }
  | { name: "admin" }
  | { name: "privacy" }
  | { name: "notFound" };

export function parseRoute(pathname: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (path === "/") return { name: "home" };
  if (path === "/admin") return { name: "admin" };
  if (path === "/privacy") return { name: "privacy" };

  const roomMatch = /^\/r\/([^/]+)$/.exec(path);
  if (roomMatch?.[1]) {
    const code = roomMatch[1].toUpperCase();
    return roomCodeSchema.safeParse(code).success ? { name: "room", code } : { name: "notFound" };
  }
  return { name: "notFound" };
}

const ROUTE_CHANGE = "playden:route";

export function navigate(path: string): void {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event(ROUTE_CHANGE));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  useEffect(() => {
    const update = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener("popstate", update);
    window.addEventListener(ROUTE_CHANGE, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(ROUTE_CHANGE, update);
    };
  }, []);
  return route;
}
