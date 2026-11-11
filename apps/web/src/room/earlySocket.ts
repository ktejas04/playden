import { parseRoute } from "../router";
import { roomSocketPath } from "./socketUrl";

interface Closable {
  close(code: number): void;
}

/**
 * Holds one room socket opened before the room screen exists: while the app is still
 * loading a room link, or when the lobby's Join button is tapped. The room screen takes
 * it over, so the member list is often already there when the screen appears.
 */
export function createEarlySocket<T extends Closable>(open: (url: string) => T) {
  let early: { code: string; socket: T } | null = null;

  function join(code: string, socketBase: string) {
    early?.socket.close(1000);
    early = { code, socket: open(socketBase + roomSocketPath(code)) };
  }

  return {
    join,

    /** `skip` leaves out a room this tab handed to another device (D49). */
    start(pathname: string, socketBase: string, skip?: (code: string) => boolean) {
      const route = parseRoute(pathname);
      if (route.name === "room" && !skip?.(route.code)) join(route.code, socketBase);
    },

    /** The waiting socket for this room, left in place for the room screen to take. */
    peek(code: string): T | null {
      return early?.code === code ? early.socket : null;
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

const createdHere = new Set<string>();

/** Remembers that this device just created the room, so its first view can skip waiting. */
export function markCreatedHere(code: string) {
  createdHere.add(code);
}

/** True for a room this device just created: the creator is its only player and host. */
export function wasCreatedHere(code: string): boolean {
  return createdHere.has(code);
}

/** After the first view, a later visit (maybe no longer host) waits for the room as usual. */
export function forgetCreatedHere(code: string) {
  createdHere.delete(code);
}

export type RoomAnswer = { kind: "joined" } | { kind: "closed"; code: number } | { kind: "slow" };

/** Waits for a room socket's first word: any message means joined, a close means refused. */
export function waitForAnswer(socket: EventTarget, timeoutMs: number): Promise<RoomAnswer> {
  return new Promise((resolve) => {
    const finish = (answer: RoomAnswer) => {
      clearTimeout(timer);
      socket.removeEventListener("message", onMessage);
      socket.removeEventListener("close", onClose);
      resolve(answer);
    };
    const onMessage = () => finish({ kind: "joined" });
    const onClose = (event: Event) => finish({ kind: "closed", code: (event as CloseEvent).code });
    const timer = setTimeout(() => finish({ kind: "slow" }), timeoutMs);
    socket.addEventListener("message", onMessage);
    socket.addEventListener("close", onClose);
  });
}

/** A socket that keeps what arrives before anyone is listening, then hands it over. */
export interface BufferedSocket {
  ws: WebSocket;
  /** Messages and the close code (if any) received so far; buffering stops after this. */
  drain(): { messages: string[]; closeCode: number | null };
  /** The room's first answer, counting anything that already arrived. */
  answer(timeoutMs: number): Promise<RoomAnswer>;
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
    answer(timeoutMs) {
      if (messages.length > 0) return Promise.resolve({ kind: "joined" });
      if (closeCode !== null) return Promise.resolve({ kind: "closed", code: closeCode });
      return waitForAnswer(ws, timeoutMs);
    },
    close: (code) => ws.close(code),
  };
}

export const earlyRoomSocket = createEarlySocket(openBuffered);
