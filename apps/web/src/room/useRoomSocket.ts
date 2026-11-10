import {
  type ClientMessage,
  type RoomPlayer,
  type ServerMessage,
  parseServerMessage,
} from "@playden/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { backoffDelay } from "./backoff";
import { closeOutcome } from "./closeOutcome";
import { earlyRoomSocket } from "./earlySocket";
import { socketUrl } from "./socketUrl";

const PING_EVERY_MS = 25_000;

export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "missing" | "removed";

/** Server messages the screen shows as toasts: someone was removed, or a request was refused. */
export type RoomNotice = Extract<ServerMessage, { type: "removed" | "error" }>;

interface RoomSocketHandlers {
  /** The account can't play (signed out or not allowed); the app rechecks it. */
  onRefused: () => void;
  onNotice: (notice: RoomNotice) => void;
}

/**
 * The room's live connection. Joining is a single socket: the server answers with the
 * member list, or closes with a code saying the room is gone, you were removed, or the
 * account can't play. `myId` lets it act on its own removal notice without waiting for the close.
 */
export function useRoomSocket(code: string, myId: string, handlers: RoomSocketHandlers) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const handlersRef = useRef(handlers);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    function receive(data: string) {
      const parsed = parseServerMessage(data);
      if (!parsed.ok) return;
      const message = parsed.message;
      if (message.type === "removed" && message.playerId === myId) {
        stopped = true;
        setStatus("removed");
        socket?.close(1000, "removed");
        return;
      }
      if (message.type === "removed" || message.type === "error") {
        handlersRef.current.onNotice(message);
        return;
      }
      if (message.type !== "snapshot") return;
      attempt = 0;
      setPlayers(message.room.players);
      setHostId(message.room.hostId);
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
      if (outcome === "refused") handlersRef.current.onRefused();
      else setStatus(outcome);
    }

    function connect() {
      clearTimeout(retryTimer);
      const early = earlyRoomSocket.take(code);
      const ws = early?.ws ?? new WebSocket(socketUrl(window.location, code));
      socket = ws;
      socketRef.current = ws;
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
  }, [code, myId]);

  const removePlayer = useCallback((playerId: string) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN)
      ws.send(JSON.stringify({ type: "remove", playerId } satisfies ClientMessage));
  }, []);

  return { status, players, hostId, removePlayer };
}
