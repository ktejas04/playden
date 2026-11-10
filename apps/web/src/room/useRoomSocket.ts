import { type RoomPlayer, parseServerMessage } from "@playden/protocol";
import { useEffect, useRef, useState } from "react";
import { backoffDelay } from "./backoff";
import { closeOutcome } from "./closeOutcome";
import { earlyRoomSocket } from "./earlySocket";
import { socketUrl } from "./socketUrl";

const PING_EVERY_MS = 25_000;

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "missing";

/**
 * The room's live connection. Joining is a single socket: the server answers with the
 * member list, or closes with a code saying the room is gone or the account can't play.
 * `onRefused` runs on the latter so the app can recheck the account.
 */
export function useRoomSocket(code: string, onRefused: () => void) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const onRefusedRef = useRef(onRefused);

  useEffect(() => {
    onRefusedRef.current = onRefused;
  }, [onRefused]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function receive(data: string) {
      const parsed = parseServerMessage(data);
      if (!parsed.ok || parsed.message.type !== "snapshot") return;
      attempt = 0;
      setPlayers(parsed.message.room.players);
      setHostId(parsed.message.room.hostId);
      setStatus("live");
    }

    function closed(ws: WebSocket, closeCode: number) {
      if (stopped || socket !== ws) return;
      const outcome = closeOutcome(closeCode);
      if (outcome === "retry") {
        setStatus("reconnecting");
        retryTimer = setTimeout(connect, backoffDelay(attempt++));
        return;
      }
      stopped = true;
      if (outcome === "missing") setStatus("missing");
      else onRefusedRef.current();
    }

    function connect() {
      clearTimeout(retryTimer);
      const early = earlyRoomSocket.take(code);
      const ws = early?.ws ?? new WebSocket(socketUrl(window.location, code));
      socket = ws;
      ws.addEventListener("message", (event) => {
        if (typeof event.data === "string") receive(event.data);
      });
      ws.addEventListener("close", (event) => closed(ws, event.code));

      if (early) {
        const { messages, closeCode } = early.drain();
        for (const message of messages) receive(message);
        if (closeCode !== null) closed(ws, closeCode);
      }
    }

    // Phones drop sockets when the screen locks; reconnect at once when the tab is visible again.
    function onVisible() {
      if (stopped || document.visibilityState !== "visible") return;
      if (socket && socket.readyState <= WebSocket.OPEN) return;
      attempt = 0;
      connect();
    }

    const pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping", t: Date.now() }));
      }
    }, PING_EVERY_MS);

    connect();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearInterval(pingTimer);
      document.removeEventListener("visibilitychange", onVisible);
      socket?.close(1000, "left");
    };
  }, [code]);

  return { status, players, hostId };
}
