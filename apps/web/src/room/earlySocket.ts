import { parseRoute } from "../router";
import { roomSocketPath } from "./socketUrl";

interface Closable {
  close(code: number): void;
}

/**
 * Holds one room socket opened while the app is still loading, so joining runs in
 * parallel with the sign-in check instead of after it. The room screen takes it over.
 */
export function createEarlySocket<T extends Closable>(open: (url: string) => T) {
  let early: { code: string; socket: T } | null = null;

  return {
    start(pathname: string, socketBase: string) {
      const route = parseRoute(pathname);
      if (route.name !== "room") return;
      early = { code: route.code, socket: open(socketBase + roomSocketPath(route.code)) };
    },

    take(code: string): T | null {
      const taken = early;
      early = null;
      if (!taken) return null;
      if (taken.code === code) return taken.socket;
      taken.socket.close(1000);
      return null;
    },

    /** Closes the socket if the room screen never took it, e.g. the person can't play yet. */
    abandon() {
      early?.socket.close(1000);
      early = null;
    },
  };
}

/** A socket that keeps what arrives before anyone is listening, then hands it over. */
export interface BufferedSocket {
  ws: WebSocket;
  /** Messages and the close code (if any) received so far; buffering stops after this. */
  drain(): { messages: string[]; closeCode: number | null };
  close(code: number): void;
}

function openBuffered(url: string): BufferedSocket {
  const ws = new WebSocket(url);
  let buffering = true;
  const messages: string[] = [];
  let closeCode: number | null = null;
  ws.addEventListener("message", (event) => {
    if (buffering && typeof event.data === "string") messages.push(event.data);
  });
  ws.addEventListener("close", (event) => {
    if (buffering) closeCode = event.code;
  });
  return {
    ws,
    drain() {
      buffering = false;
      return { messages, closeCode };
    },
    close: (code) => ws.close(code),
  };
}

export const earlyRoomSocket = createEarlySocket(openBuffered);
