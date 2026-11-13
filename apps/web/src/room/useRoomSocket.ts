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
import {
  type DeltaApplier,
  NO_GAME,
  type RoomGame,
  clockOffset,
  isGameMessage,
  reduceGame,
} from "./gameState";
import { findWebGame } from "../games";
import { navigate } from "../router";
import { replacedHere } from "./replacedHere";
import { socketUrl } from "./socketUrl";

const PING_EVERY_MS = 25_000;

/** A game's own way to apply its deltas (D55), from its definition. */
const applierFor: DeltaApplier = (gameId) => {
  const applyDelta = findWebGame(gameId)?.definition.applyDelta;
  return applyDelta ? (view, delta) => applyDelta(view, delta) : undefined;
};

export type ConnectionStatus =
  "connecting" | "live" | "reconnecting" | "missing" | "removed" | "replaced";

/** Server messages the screen shows as toasts: someone was removed, or a request was refused. */
export type RoomNotice = Extract<ServerMessage, { type: "removed" | "error" | "game.notice" }>;

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
export function useRoomSocket(
  code: string,
  myId: string,
  handlers: RoomSocketHandlers,
  /** What the room is known to look like before it answers, e.g. a room you just created. */
  initial?: { players: RoomPlayer[]; hostId: string },
) {
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    replacedHere.has(code) ? "replaced" : "connecting",
  );
  // Bumped by Play here to open a fresh connection after this tab was replaced.
  const [generation, setGeneration] = useState(0);
  const [players, setPlayers] = useState<RoomPlayer[]>(initial?.players ?? []);
  const [hostId, setHostId] = useState<string | null>(initial?.hostId ?? null);
  const [game, setGame] = useState<RoomGame>(NO_GAME);
  const handlersRef = useRef(handlers);
  const socketRef = useRef<WebSocket | null>(null);
  /** Server clock minus this device's clock, from the latest ping. */
  const offsetRef = useRef(0);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    // A tab that handed its seat to another device stays put until Play here (D49).
    if (replacedHere.has(code)) return;
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
      if (message.type === "replaced") {
        stopped = true;
        replacedHere.mark(code);
        setStatus("replaced");
        socket?.close(1000, "replaced");
        return;
      }
      if (
        message.type === "removed" ||
        message.type === "error" ||
        message.type === "game.notice"
      ) {
        handlersRef.current.onNotice(message);
        return;
      }
      if (message.type === "pong") {
        offsetRef.current = clockOffset(message.t, message.serverTime, Date.now());
        return;
      }
      if (isGameMessage(message)) {
        setGame((current) => reduceGame(current, message, applierFor));
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
      if (outcome === "replaced") replacedHere.mark(code);
      if (outcome === "refused") handlersRef.current.onRefused();
      else setStatus(outcome);
    }

    function ping(ws: WebSocket) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping", t: Date.now() } satisfies ClientMessage));
      }
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
      // Measure the clock offset at once, so game countdowns are right from the start.
      ws.addEventListener("open", () => ping(ws));
      ping(ws);

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
      if (socket) ping(socket);
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
  }, [code, myId, generation]);

  /** Sends a message if connected; the room answers with new state or an error. */
  const send = useCallback((message: ClientMessage) => {
    const ws = socketRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
  }, []);

  // A missed delta (D55): ask once for the full view; deltas wait until it arrives.
  useEffect(() => {
    if (game.needsResync) send({ type: "game.resync" });
  }, [game.needsResync, send]);

  const removePlayer = useCallback(
    (playerId: string) => send({ type: "remove", playerId }),
    [send],
  );

  /** Server time now, for game countdowns. */
  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  /** Takes the seat back from the other device. */
  const playHere = useCallback(() => {
    replacedHere.clear(code);
    setStatus("connecting");
    setGeneration((g) => g + 1);
  }, [code]);

  /** Leaving on purpose: the room drops you at once (no away grace), then off to the Lobby. */
  const leaveRoom = useCallback(() => {
    send({ type: "leave" });
    navigate("/");
  }, [send]);

  return { status, players, hostId, game, send, serverNow, removePlayer, playHere, leaveRoom };
}
