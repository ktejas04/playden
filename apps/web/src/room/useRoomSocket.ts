import { type RoomPlayer, parseServerMessage } from "@playden/protocol";
import { useEffect, useState } from "react";
import { backoffDelay } from "./backoff";
import { socketUrl } from "./socketUrl";

const PING_EVERY_MS = 25_000;

export type ConnectionStatus = "connecting" | "live" | "reconnecting";

export function useRoomSocket(code: string) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [players, setPlayers] = useState<RoomPlayer[]>([]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function connect() {
      clearTimeout(retryTimer);
      const ws = new WebSocket(socketUrl(window.location, code));
      socket = ws;
      ws.onopen = () => {
        attempt = 0;
        setStatus("live");
      };
      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const parsed = parseServerMessage(event.data);
        if (parsed.ok && parsed.message.type === "snapshot")
          setPlayers(parsed.message.room.players);
      };
      ws.onclose = () => {
        if (stopped || socket !== ws) return;
        setStatus("reconnecting");
        retryTimer = setTimeout(connect, backoffDelay(attempt++));
      };
    }

    // Phones drop sockets when the screen locks; reconnect at once when the tab is visible again.
    function onVisible() {
      if (document.visibilityState !== "visible") return;
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

  return { status, players };
}
