import type { AnyGame } from "@playden/engine";
import type { ParticipantRecord, RecordWrite } from "../db/gameRecords";
import { type Session, type TableState, endGame } from "./roomGame";

/**
 * Which writes to the permanent record (D58) a change of the room's table needs. Pure: the
 * room works out the writes here and hands them to its RecordWriter. Most changes (moves,
 * joins in setup) need none.
 */

/**
 * A session gets a fresh record id when it's new, or when the host switched to another game
 * in setup (that's a new record; the old one goes inactive). Otherwise it keeps its id.
 */
export function withRecordId(
  before: TableState,
  after: TableState,
  newId: () => string,
): TableState {
  const prev = before.session;
  const next = after.session;
  if (!next) return after;
  const sameRecord = prev !== null && prev.id === next.id && prev.gameId === next.gameId;
  // A session from before records existed keeps having none.
  const recordId = sameRecord ? prev.recordId : newId();
  if (next.recordId === recordId) return after;
  return { ...after, session: { ...next, recordId } };
}

/** The team every winner is on, or null for a draw, an early end or a game without teams. */
function winningTeam(session: Session): number | null {
  const winners = session.result?.winners ?? [];
  const teams = new Set(winners.map((id) => session.players.find((p) => p.id === id)?.team));
  if (session.endedEarly || teams.size !== 1) return null;
  const [team] = teams;
  return team ?? null;
}

/** Players first, then spectators who aren't also players (someone who left can spectate). */
function participants(session: Session, { scored }: { scored: boolean }): ParticipantRecord[] {
  const players: ParticipantRecord[] = session.players.map((p) => ({
    userId: p.id,
    role: "player",
    team: p.team ?? null,
    score: scored ? (session.result?.scores[p.id] ?? null) : null,
    leftEarly: p.left,
    leaveReason: p.left ? (session.leaveReasons?.[p.id] ?? "left") : null,
  }));
  const playerIds = new Set(players.map((p) => p.userId));
  const spectators: ParticipantRecord[] = session.spectators
    .filter((id) => !playerIds.has(id))
    .map((id) => ({
      userId: id,
      role: "spectator",
      team: null,
      score: null,
      leftEarly: false,
      leaveReason: null,
    }));
  return [...players, ...spectators];
}

function ended(
  session: Session,
  recordId: string,
  game: AnyGame | undefined,
  now: number,
): RecordWrite {
  return {
    kind: "gameEnded",
    gameId: recordId,
    status: session.endedEarly ? "ended_early" : "finished",
    at: now,
    winningTeam: winningTeam(session),
    summary: game?.recordSummary?.(session.state) ?? null,
    participants: participants(session, { scored: true }),
  };
}

export function recordWrites(
  before: TableState,
  after: TableState,
  {
    roomId,
    hostId,
    now,
    game,
  }: { roomId: string; hostId: string | null; now: number; game: AnyGame | undefined },
): RecordWrite[] {
  const prev = before.session;
  const next = after.session;
  const writes: RecordWrite[] = [];
  const prevId = prev?.recordId;
  const nextId = next?.recordId;

  // The old record goes inactive first, so the room never has two active games.
  if (prevId !== undefined && prevId !== nextId) {
    writes.push({ kind: "gameDeactivated", gameId: prevId });
  }
  if (!next || nextId === undefined) return writes;

  if (nextId !== prevId) {
    writes.push({
      kind: "gameOpened",
      gameId: nextId,
      roomId,
      gameType: next.gameId,
      config: next.config,
      createdBy: hostId,
      at: now,
    });
    return writes;
  }
  if (prev?.phase === "setup" && next.phase === "playing") {
    writes.push({
      kind: "gameStarted",
      gameId: nextId,
      config: next.config,
      at: next.startsAt ?? now,
      participants: participants(next, { scored: false }),
    });
  }
  if (prev?.phase === "playing" && next.phase === "results") {
    writes.push(ended(next, nextId, game, now));
  }
  return writes;
}

/** Host passed on while the room has a recorded game: its host_id follows (D58). */
export function hostWrites(session: Session | null, hostId: string): RecordWrite[] {
  const gameId = session?.recordId;
  return gameId === undefined ? [] : [{ kind: "hostChanged", gameId, hostId }];
}

/**
 * The room is closing: a running game ends early, its record goes inactive, everyone still
 * listed is closed out, and the room closes.
 */
export function closingWrites(
  table: TableState,
  { roomId, now, game }: { roomId: string; now: number; game: AnyGame | undefined },
): RecordWrite[] {
  const writes: RecordWrite[] = [];
  const session = table.session;
  if (session?.recordId !== undefined) {
    if (session.phase === "playing" && game) {
      const outcome = endGame(table, game);
      if (outcome.ok && outcome.table.session) {
        writes.push(ended(outcome.table.session, session.recordId, game, now));
      }
    }
    writes.push({ kind: "gameDeactivated", gameId: session.recordId });
  }
  writes.push({ kind: "membersClosed", roomId, at: now });
  writes.push({ kind: "roomClosed", roomId, at: now });
  return writes;
}
