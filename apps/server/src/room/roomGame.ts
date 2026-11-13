import {
  type AnyGame,
  type GameEvent,
  type GameResult,
  type Seat,
  createRng,
  seatForNewcomer,
  seatInOrder,
  seatProblem,
  shuffle,
  teamSizes,
} from "@playden/engine";
import {
  type GameNotice,
  type GameSession,
  type GameStatus,
  activePlayers,
  roleIn,
} from "@playden/protocol";

/**
 * The game side of a room (docs/design/rooms-and-games.md): at most one game session, with
 * its players, spectators and bans, and the game's own state. Every function here is pure;
 * the Room object stores the table and does the talking. The room never knows any game's
 * rules: it only calls the game's schemas and functions.
 */
export interface Session extends GameSession {
  seed: number | null;
  /** The engine's state; never sent to browsers. */
  state: unknown;
}

export interface TableState {
  /** The last session id handed out in this room. */
  lastSessionId: number;
  /** Null while the room is idle. */
  session: Session | null;
}

export const EMPTY_TABLE: TableState = { lastSessionId: 0, session: null };

export interface Person {
  id: string;
  name: string;
}

export type TableOutcome =
  { ok: true; table: TableState; events: GameEvent[] } | { ok: false; reason: string };

const done = (table: TableState, events: GameEvent[] = []): TableOutcome => ({
  ok: true,
  table,
  events,
});
const refuse = (reason: string): TableOutcome => ({ ok: false, reason });
const withSession = (table: TableState, session: Session): TableState => ({ ...table, session });
const without = (ids: string[], id: string) => ids.filter((other) => other !== id);

function seatsOf(session: Session): Seat[] {
  return activePlayers(session).map(({ id, name, team }) =>
    team === undefined ? { id, name } : { id, name, team },
  );
}

function newSession(table: TableState, game: AnyGame, fields: Partial<Session>): TableState {
  const id = table.lastSessionId + 1;
  return {
    lastSessionId: id,
    session: {
      id,
      phase: "setup",
      gameId: game.id,
      config: game.defaultConfig,
      players: [],
      spectators: [],
      banned: [],
      result: null,
      endedEarly: false,
      startsAt: null,
      seed: null,
      state: null,
      ...fields,
    },
  };
}

/**
 * Host: open setup for a game (the host joins it), or switch the game during setup. A switch
 * keeps everyone's choice; players who no longer fit move to spectating.
 */
export function pickGame(
  table: TableState,
  host: Person,
  gameId: string,
  find: (id: string) => AnyGame | undefined,
  { allowDevOnly }: { allowDevOnly: boolean },
): TableOutcome {
  const { session } = table;
  if (session?.phase === "playing") return refuse("Finish this game first");
  if (session?.phase === "results") return refuse("Return to the room first");
  const game = find(gameId);
  if (!game || (game.devOnly && !allowDevOnly)) return refuse("That game isn't available");

  if (!session) {
    const seat = seatForNewcomer(game, [], host);
    return done(newSession(table, game, { players: seat ? [{ ...seat, left: false }] : [] }));
  }
  const { seats, overflow } = seatInOrder(game, activePlayers(session));
  return done(
    withSession(table, {
      ...session,
      gameId: game.id,
      config: game.defaultConfig,
      players: seats.map((seat) => ({ ...seat, left: false })),
      spectators: [...session.spectators, ...overflow],
    }),
  );
}

export function setConfig(table: TableState, raw: unknown, game: AnyGame): TableOutcome {
  const { session } = table;
  if (session?.phase !== "setup") return refuse("Settings can only change before the game starts");
  const parsed = game.configSchema.safeParse(raw);
  if (!parsed.success) {
    return refuse(
      `Those settings aren't valid: ${parsed.error.issues[0]?.message ?? "check them"}`,
    );
  }
  return done(withSession(table, { ...session, config: parsed.data }));
}

function notInSetup(session: Session | null): string | null {
  if (!session) return "No game is being set up";
  if (session.phase === "playing") return "The game has already started";
  if (session.phase === "results") return "The game has ended";
  return null;
}

/** In setup: take a seat (also from spectating). Joining a team game picks the smaller team. */
export function join(table: TableState, person: Person, game: AnyGame): TableOutcome {
  const { session } = table;
  const problem = notInSetup(session);
  if (problem || !session) return refuse(problem ?? "No game is being set up");
  if (session.banned.includes(person.id)) return refuse("You can't play in this game");
  if (roleIn(session, person.id) === "player") return done(table);
  const seat = seatForNewcomer(game, seatsOf(session), person);
  if (!seat) return refuse("Game is full");
  return done(
    withSession(table, {
      ...session,
      players: [...session.players, { ...seat, left: false }],
      spectators: without(session.spectators, person.id),
    }),
  );
}

/**
 * In setup, a player moves to another team. They go to the end of it: a team's order is its
 * rotation order (e.g. who draws next). Uneven teams are the players' call; Start only checks
 * each team's minimum and maximum.
 */
export function switchTeam(
  table: TableState,
  personId: string,
  team: number,
  game: AnyGame,
): TableOutcome {
  const { session } = table;
  const problem = notInSetup(session);
  if (problem || !session) return refuse(problem ?? "No game is being set up");
  if (!game.teams) return refuse("This game has no teams");
  if (!Number.isInteger(team) || team < 0 || team >= game.teams.count) {
    return refuse("That team doesn't exist");
  }
  const me = activePlayers(session).find((p) => p.id === personId);
  if (!me) return refuse("Join the game first");
  if (me.team === team) return done(table);
  if ((teamSizes(game.teams, seatsOf(session))[team] ?? 0) >= game.teams.maxSize) {
    return refuse(`Team ${team + 1} is full`);
  }
  return done(
    withSession(table, {
      ...session,
      players: [...session.players.filter((p) => p.id !== personId), { ...me, team }],
    }),
  );
}

/**
 * Host, in setup: deals every player into even teams at random (sizes differ by at most 1).
 * The new order is each team's rotation order.
 */
export function shuffleTeams(table: TableState, game: AnyGame, seed: number): TableOutcome {
  const { session } = table;
  const problem = notInSetup(session);
  if (problem || !session) return refuse(problem ?? "No game is being set up");
  if (!game.teams) return refuse("This game has no teams");
  const { count } = game.teams;
  const dealt = shuffle(createRng(seed), activePlayers(session)).value;
  return done(
    withSession(table, {
      ...session,
      players: dealt.map((player, index) => ({ ...player, team: index % count })),
    }),
  );
}

/** Spectate: in setup anyone but the host (players switch); mid-game anyone not playing. */
export function spectate(table: TableState, personId: string, hostId: string): TableOutcome {
  const { session } = table;
  if (!session) return refuse("No game is being set up");
  if (session.phase === "results") return refuse("The game has ended");
  const role = roleIn(session, personId);
  if (role === "spectator") return done(table);
  if (session.phase === "setup") {
    if (personId === hostId) return refuse("The host always plays");
    return done(
      withSession(table, {
        ...session,
        players: session.players.filter((p) => p.id !== personId),
        spectators: [...session.spectators, personId],
      }),
    );
  }
  if (role === "player") return refuse("Leave the game first");
  return done(withSession(table, { ...session, spectators: [...session.spectators, personId] }));
}

/** Ends a running game now: the game's standings so far (0 for everyone without them), no winner. */
function endEarly(session: Session, game: AnyGame): Session {
  const standings = game.standings?.(session.state);
  const scores = Object.fromEntries(session.players.map((p) => [p.id, standings?.[p.id] ?? 0]));
  return { ...session, phase: "results", result: { scores, winners: [] }, endedEarly: true };
}

/** A player is out of a running game: the seat is freed and the game is told. */
function seatFreed(
  table: TableState,
  session: Session,
  game: AnyGame,
  playerId: string,
  { ban }: { ban: boolean },
): TableOutcome {
  const { state, events } = game.onPlayerLeft(session.state, playerId);
  const next: Session = {
    ...session,
    state,
    players: session.players.map((p) => (p.id === playerId ? { ...p, left: true } : p)),
    spectators: without(session.spectators, playerId),
    banned: ban ? [...session.banned, playerId] : session.banned,
  };
  if (activePlayers(next).length === 0)
    return done(withSession(table, endEarly(next, game)), events);
  return settle(table, next, game, events);
}

/**
 * Back to just being in the room. In setup a player un-joins (not the host); mid-game a
 * player's seat is freed; spectators stop spectating.
 */
export function leave(
  table: TableState,
  personId: string,
  hostId: string,
  game: AnyGame,
): TableOutcome {
  const { session } = table;
  if (!session) return done(table);
  const role = roleIn(session, personId);
  if (role === null) return done(table);
  if (role === "spectator") {
    return done(
      withSession(table, { ...session, spectators: without(session.spectators, personId) }),
    );
  }
  if (session.phase === "setup") {
    if (personId === hostId) return refuse("The host always plays");
    return done(
      withSession(table, { ...session, players: session.players.filter((p) => p.id !== personId) }),
    );
  }
  if (session.phase === "results") {
    if (personId === hostId) return refuse("Pick Play again or Return to room");
    const players = session.players.map((p) => (p.id === personId ? { ...p, left: true } : p));
    return done(withSession(table, { ...session, players }));
  }
  return seatFreed(table, session, game, personId, { ban: false });
}

/** Host: someone is out of this session's game; they can spectate, and play again next session. */
export function ban(
  table: TableState,
  targetId: string,
  hostId: string,
  game: AnyGame,
): TableOutcome {
  const { session } = table;
  if (targetId === hostId) return refuse("You can't ban yourself");
  if (!session || session.phase === "results") return refuse("No game is running");
  if (roleIn(session, targetId) !== "player") return refuse("They aren't playing");
  if (session.phase === "setup") {
    return done(
      withSession(table, {
        ...session,
        players: session.players.filter((p) => p.id !== targetId),
        banned: [...session.banned, targetId],
      }),
    );
  }
  return seatFreed(table, session, game, targetId, { ban: true });
}

/** Removed from the room (D42): out of the session at once, as if they left. */
export function memberRemoved(table: TableState, personId: string, game: AnyGame): TableOutcome {
  const { session } = table;
  if (!session) return done(table);
  if (session.phase === "playing" && roleIn(session, personId) === "player") {
    return seatFreed(table, session, game, personId, { ban: false });
  }
  if (session.phase === "results") {
    return done(
      withSession(table, { ...session, spectators: without(session.spectators, personId) }),
    );
  }
  return done(
    withSession(table, {
      ...session,
      players:
        session.phase === "setup"
          ? session.players.filter((p) => p.id !== personId)
          : session.players,
      spectators: without(session.spectators, personId),
    }),
  );
}

/** The host always plays in setup; a new host is seated when there's room. */
export function hostPlays(table: TableState, host: Person, game: AnyGame): TableOutcome {
  const { session } = table;
  if (session?.phase !== "setup" || roleIn(session, host.id) === "player") return done(table);
  const outcome = join(table, host, game);
  return outcome.ok ? outcome : done(table);
}

/**
 * Host: start. Play begins `countdownMs` from now (every screen counts down to it); the game
 * is set up as of that moment, so its own timers start when play does.
 */
export function startGame(
  table: TableState,
  game: AnyGame,
  seed: number,
  now: number,
  { countdownMs = 0 }: { countdownMs?: number } = {},
): TableOutcome {
  const { session } = table;
  if (session?.phase !== "setup") return refuse("No game is being set up");
  const seats = seatsOf(session);
  const problem = seatProblem(game, seats);
  if (problem) return refuse(problem);
  const startsAt = now + countdownMs;
  const state = game.setup(seats, session.config, seed, startsAt);
  return done(withSession(table, { ...session, phase: "playing", seed, state, startsAt }));
}

/** After a change to a running game: it either goes on or has a result. */
function settle(
  table: TableState,
  session: Session,
  game: AnyGame,
  events: GameEvent[],
): TableOutcome {
  const result: GameResult | null = game.result(session.state);
  return done(
    withSession(table, result ? { ...session, phase: "results", result } : session),
    events,
  );
}

export function applyMove(
  table: TableState,
  game: AnyGame,
  playerId: string,
  raw: unknown,
  now: number,
): TableOutcome {
  const { session } = table;
  if (!session || session.phase === "setup") return refuse("The game hasn't started");
  if (session.phase === "results") return refuse("The game has ended");
  if (session.startsAt !== null && now < session.startsAt) return refuse("Wait for the countdown");
  const role = roleIn(session, playerId);
  if (role === "spectator") return refuse("You're spectating this game");
  if (role === null) return refuse("You're not in this game");
  const parsed = game.moveSchema.safeParse(raw);
  if (!parsed.success) return refuse("That move isn't valid");
  const verdict = game.validate(session.state, playerId, parsed.data, now);
  if (!verdict.ok) return refuse(verdict.reason);
  const { state, events } = game.apply(session.state, playerId, parsed.data, now);
  return settle(table, { ...session, state }, game, events);
}

/** Host, mid-game: finish now as "ended early". */
export function endGame(table: TableState, game: AnyGame): TableOutcome {
  const { session } = table;
  if (session?.phase !== "playing") return refuse("No game is running");
  return done(withSession(table, endEarly(session, game)));
}

export function nextDeadline(table: TableState, game: AnyGame): number | null {
  return table.session?.phase === "playing" ? game.nextDeadline(table.session.state) : null;
}

export function fireDeadline(table: TableState, game: AnyGame, now: number): TableOutcome {
  const { session } = table;
  if (session?.phase !== "playing") return done(table);
  const { state, events } = game.onDeadline(session.state, now);
  return settle(table, { ...session, state }, game, events);
}

/**
 * Host, after a game: setup again with the same game and settings. The last game's players
 * and spectators who are still in the room keep their roles (players their teams).
 */
export function playAgain(table: TableState, game: AnyGame, presentIds: string[]): TableOutcome {
  const { session } = table;
  if (session?.phase !== "results") return refuse("The game isn't over yet");
  const present = new Set(presentIds);
  return done(
    newSession(table, game, {
      config: session.config,
      players: activePlayers(session).filter((p) => present.has(p.id)),
      spectators: session.spectators.filter((id) => present.has(id)),
    }),
  );
}

/**
 * After a game, the host is always a player (host.ts). If no player of it is still in the
 * room, nobody can take the next step, so the session closes and the room is idle again.
 */
export function closeIfNoPlayers(table: TableState, presentIds: readonly string[]): TableOutcome {
  const { session } = table;
  if (session?.phase !== "results") return done(table);
  if (activePlayers(session).some((p) => presentIds.includes(p.id))) return done(table);
  return done({ ...table, session: null });
}

/** Host: cancel setup, or leave the results; the room is idle again. */
export function returnToRoom(table: TableState): TableOutcome {
  if (table.session?.phase === "playing") return refuse("End the game first");
  return done({ ...table, session: null });
}

/**
 * Who should hear that a player is out of a running game (Leave game, or a ban): their
 * teammates, everyone playing in games without teams, and the host unless it was the host's
 * own ban. Never the player, opponents or spectators. Null when nothing needs saying: it
 * wasn't mid-game, or they weren't playing.
 */
export function seatNotice(
  before: TableState,
  after: TableState,
  playerId: string,
  hostId: string,
  kind: GameNotice["kind"],
): { notice: GameNotice; to: string[] } | null {
  const was = before.session;
  if (was?.phase !== "playing" || roleIn(was, playerId) !== "player") return null;
  if (!after.session || roleIn(after.session, playerId) === "player") return null;
  const player = was.players.find((p) => p.id === playerId);
  if (!player) return null;
  // Whoever did it already knows: the player who left, or the host who banned.
  const actor = kind === "left" ? playerId : hostId;
  const teammates = activePlayers(after.session)
    .filter((p) => player.team === undefined || p.team === player.team)
    .map((p) => p.id);
  const to = [...new Set([...teammates, hostId])].filter((id) => id !== playerId && id !== actor);
  return { notice: { type: "game.notice", kind, playerId, name: player.name }, to };
}

/** A player's own view, the spectator view, or null for someone just in the room. */
export function viewFor(table: TableState, game: AnyGame, viewerId: string): unknown {
  const { session } = table;
  if (!session || session.phase === "setup") return null;
  const role = roleIn(session, viewerId);
  if (role === null) return null;
  return game.view(session.state, role === "player" ? viewerId : "spectator");
}

/** The session as everyone may see it: no seed, no engine state. */
export function statusOf(table: TableState): GameStatus {
  if (!table.session) return { type: "game.status", session: null };
  const { id, phase, gameId, config, players, spectators, banned, startsAt, result, endedEarly } =
    table.session;
  return {
    type: "game.status",
    session: {
      id,
      phase,
      gameId,
      config,
      players,
      spectators,
      banned,
      startsAt,
      result,
      endedEarly,
    },
  };
}
