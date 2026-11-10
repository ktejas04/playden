import { type RoomPlayer, parseServerMessage } from "@playden/protocol";
import { useEffect, useState } from "react";
import { roomExists } from "../api";
import { backoffDelay } from "./backoff";
import { socketUrl } from "./socketUrl";

const PING_EVERY_MS = 25_000;

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "missing";

export function useRoomSocket(code: string) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function retry() {
      setStatus("reconnecting");
      retryTimer = setTimeout(() => void connect(), backoffDelay(attempt++));
    }

    // Each (re)connect first asks whether the room still exists, so a closed room
    // shows "Room not found" instead of reconnecting forever.
    async function connect() {
      clearTimeout(retryTimer);
      let exists: boolean;
      try {
        exists = await roomExists(code);
      } catch {
        if (!stopped) retry();
        return;
      }
      if (stopped) return;
      if (!exists) {
        stopped = true;
        setStatus("missing");
        return;
      }

      const ws = new WebSocket(socketUrl(window.location, code));
      socket = ws;
      ws.onopen = () => {
        attempt = 0;
        setStatus("live");
      };
      ws.onmessage = (event) => {
        if (typeof event.data !== "string") return;
        const parsed = parseServerMessage(event.data);
        if (parsed.ok && parsed.message.type === "snapshot") {
          setPlayers(parsed.message.room.players);
          setHostId(parsed.message.room.hostId);
        }
      };
      ws.onclose = () => {
        if (stopped || socket !== ws) return;
        retry();
      };
    }

    // Phones drop sockets when the screen locks; reconnect at once when the tab is visible again.
    function onVisible() {
      if (stopped || document.visibilityState !== "visible") return;
      if (socket && socket.readyState <= WebSocket.OPEN) return;
      attempt = 0;
      void connect();
    }

    const pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping", t: Date.now() }));
      }
    }, PING_EVERY_MS);

    void connect();
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
