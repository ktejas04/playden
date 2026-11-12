import { seatProblem } from "@playden/engine";
import {
  type ClientMessage,
  type GameSession,
  type RoomPlayer,
  type SessionRole,
  activePlayers,
} from "@playden/protocol";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@playden/ui/components/alert-dialog";
import { Badge } from "@playden/ui/components/badge";
import { Button } from "@playden/ui/components/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@playden/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@playden/ui/components/dropdown-menu";
import { cn } from "@playden/ui/lib/utils";
import {
  ArrowLeftIcon,
  BanIcon,
  EyeIcon,
  FlagIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  PlayIcon,
  RepeatIcon,
  Share2Icon,
  RotateCcwIcon,
} from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { HostBadge } from "../components/HostBadge";
import { PlayerAvatar } from "../components/PlayerAvatar";
import type { WebGame } from "../games";
import { navigate, setNavigationGuard } from "../router";
import { BottomBar, Panel } from "../Shell";
import { GameList } from "./GamePicker";
import { isFull, seatsOf } from "./SessionCards";
import { GameStage, ResultsCard } from "./GameStage";

interface Confirm {
  title: string;
  body: string;
  action: string;
  /** The button that backs out; "Cancel" unless that would read oddly. */
  keep?: string;
  run: () => void;
}

const teamName = (team: number) => `Team ${team + 1}`;

function RosterRow({
  id,
  name,
  me,
  hostId,
  away,
  onBan,
}: {
  id: string;
  name: string;
  me: string;
  hostId: string | null;
  away: boolean;
  onBan?: () => void;
}) {
  return (
    <li className={cn("flex items-center gap-3 py-2.5", away && "opacity-60")}>
      <PlayerAvatar id={id} name={name} size="sm" />
      <span className={cn("flex-1 truncate", id === me ? "font-semibold" : "font-medium")}>
        {name}
        {id === me && <span className="font-normal text-muted-foreground"> (you)</span>}
      </span>
      {id === hostId && <HostBadge />}
      {away && (
        <Badge variant="outline" className="h-6 px-2 text-xs">
          Away
        </Badge>
      )}
      {onBan && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-my-1 text-muted-foreground"
              aria-label={`More for ${name}`}
            >
              <MoreHorizontalIcon className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem variant="destructive" className="h-10" onSelect={onBan}>
              <BanIcon /> Ban from game
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

/** Who plays (by team, in join order) and who spectates. Players not connected show as away. */
function Roster({
  session,
  game,
  members,
  me,
  hostId,
  onBan,
}: {
  session: GameSession;
  game: WebGame;
  members: RoomPlayer[];
  me: string;
  hostId: string | null;
  onBan?: (player: { id: string; name: string }) => void;
}) {
  const present = new Set(members.map((m) => m.id));
  const players = activePlayers(session);
  const teams = game.definition.teams;
  const groups = teams
    ? Array.from({ length: teams.count }, (_, team) => ({
        title: teamName(team),
        players: players.filter((p) => p.team === team),
      }))
    : [{ title: "Players", players }];
  const spectators = session.spectators.flatMap((id) => {
    const member = members.find((m) => m.id === id);
    return member ? [member] : [];
  });

  return (
    <Panel className="mt-4">
      <div className={cn("grid gap-x-6 gap-y-4", teams && "sm:grid-cols-2")}>
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="flex items-baseline justify-between text-base font-semibold">
              {group.title}
              <span className="text-sm font-normal text-muted-foreground">
                {group.players.length}
              </span>
            </h3>
            {group.players.length === 0 ? (
              <p className="py-2.5 text-sm text-muted-foreground">Nobody yet</p>
            ) : (
              <ul className="mt-1 divide-y">
                {group.players.map((player) => (
                  <RosterRow
                    key={player.id}
                    id={player.id}
                    name={player.name}
                    me={me}
                    hostId={hostId}
                    away={!present.has(player.id)}
                    onBan={onBan && player.id !== hostId ? () => onBan(player) : undefined}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      {spectators.length > 0 && (
        <p className="mt-4 flex items-start gap-2 border-t pt-3 text-sm text-muted-foreground">
          <EyeIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium text-foreground">Spectating:</span>{" "}
            {spectators.map((s) => (s.id === me ? `${s.name} (you)` : s.name)).join(", ")}
          </span>
        </p>
      )}
    </Panel>
  );
}

/** The one warning for giving up a seat mid-game, from the ⋯ menu or the Lobby button. */
function leaveGameConfirm(run: () => void, { toLobby }: { toLobby: boolean }): Confirm {
  return {
    title: "Leave this game?",
    body: `You lose your seat and can't come back into this game.${toLobby ? "" : " You can still spectate."}`,
    action: "Leave game",
    run,
  };
}

/**
 * Going to the Lobby from the game screen is leaving the game, by choice: mid-game a player
 * gets the Leave game warning first; otherwise (setup, spectating, results) they just leave.
 * Only accidents (lost signal, a closed tab) are drops that keep the seat; closing or
 * reloading the tab mid-game still asks the browser's own "Leave site?".
 */
function useLobbyLeavesGame(
  midGamePlayer: boolean,
  leave: () => void,
  ask: (confirm: Confirm) => void,
) {
  useEffect(() => {
    const removeGuard = setNavigationGuard((path) => {
      if (!midGamePlayer) {
        leave();
        return true;
      }
      ask(
        leaveGameConfirm(
          () => {
            leave();
            navigate(path, { force: true });
          },
          { toLobby: true },
        ),
      );
      return false;
    });
    const beforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    if (midGamePlayer) window.addEventListener("beforeunload", beforeUnload);
    return () => {
      removeGuard();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [midGamePlayer, leave, ask]);
}

/**
 * The game screen for players and spectators: setup (join or spectate, host starts), the
 * game itself, and its results (host: Play again or Return to room).
 */
export function GameScreen({
  code,
  me,
  role,
  session,
  game,
  view,
  members,
  hostId,
  live,
  send,
  serverNow,
  onInvite,
}: {
  code: string;
  me: string;
  role: Exclude<SessionRole, null>;
  session: GameSession;
  game: WebGame;
  view: unknown;
  members: RoomPlayer[];
  hostId: string | null;
  live: boolean;
  send: (message: ClientMessage) => void;
  serverNow: () => number;
  /** Shares the room link; link joins still work until the game starts. */
  onInvite: () => void;
}) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [choosingGame, setChoosingGame] = useState(false);
  const isHost = hostId === me;
  const leaveGame = useCallback(() => send({ type: "game.leave" }), [send]);
  // The host can't leave setup or results (they cancel or move on instead); going to the
  // Lobby just hands host on, as leaving the room always does.
  const lobbyLeave = useCallback(() => {
    if (!isHost || session.phase === "playing") leaveGame();
  }, [isHost, session.phase, leaveGame]);
  useLobbyLeavesGame(role === "player" && session.phase === "playing", lobbyLeave, setConfirm);
  const { phase } = session;
  const startProblem = seatProblem(game.definition, seatsOf(session));
  const full = isFull(game, session);

  const nameOf = (id: string) =>
    session.players.find((p) => p.id === id)?.name ??
    members.find((m) => m.id === id)?.name ??
    "A player who left";

  const ban =
    isHost && phase !== "results"
      ? (player: { id: string; name: string }) =>
          setConfirm({
            title: `Ban ${player.name} from this game?`,
            body:
              phase === "playing"
                ? "They leave the game now and can only spectate. They can play again in the next game."
                : "They can't join this game, only spectate. They can play again in the next game.",
            action: `Ban ${player.name}`,
            run: () => send({ type: "game.ban", playerId: player.id }),
          })
      : undefined;

  const menuItems: ReactNode[] = [];
  // Players' exits sit behind this menu, away from the game's own controls; spectators have
  // no controls to mis-tap, so their Leave is in the bottom bar instead.
  if (role === "player" && phase === "playing") {
    menuItems.push(
      <DropdownMenuItem
        key="leave"
        variant="destructive"
        className="h-10"
        onSelect={() => setConfirm(leaveGameConfirm(leaveGame, { toLobby: false }))}
      >
        <LogOutIcon /> Leave game
      </DropdownMenuItem>,
    );
  }
  if (isHost && phase === "playing") {
    menuItems.push(
      <DropdownMenuItem
        key="end"
        variant="destructive"
        className="h-10"
        onSelect={() =>
          setConfirm({
            title: "End the game for everyone?",
            body: "It stops now and shows the scores so far. Nobody wins this one.",
            action: "End game",
            run: () => send({ type: "game.end" }),
          })
        }
      >
        <FlagIcon /> End game
      </DropdownMenuItem>,
    );
  }

  return (
    <>
      <div className="flex items-center gap-3 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            Room {code} ·{" "}
            {phase === "setup" ? "Setting up" : phase === "playing" ? "Playing" : "Game over"}
          </p>
          <h1 className="truncate font-heading text-2xl font-bold">{game.definition.name}</h1>
        </div>
        <Badge variant={role === "player" ? "default" : "outline"} className="h-7 px-2.5 text-sm">
          {role === "player" ? "Playing" : "Spectating"}
        </Badge>
        {menuItems.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Game menu">
                <MoreHorizontalIcon className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {menuItems}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {phase === "setup" && (
        <Panel className="mt-4">
          <p className="text-muted-foreground">{game.definition.summary}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {isHost && (
              <Button variant="outline" size="sm" onClick={() => setChoosingGame(true)}>
                <RepeatIcon /> Change game
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onInvite}>
              <Share2Icon /> Invite
            </Button>
          </div>
        </Panel>
      )}

      {phase === "results" && session.result && (
        <ResultsCard
          result={session.result}
          endedEarly={session.endedEarly}
          nameOf={nameOf}
          teamOf={(id) => session.players.find((p) => p.id === id)?.team}
          myId={me}
        />
      )}

      {/* A game ended early never reached its own end screen, so only the scores show. */}
      {(phase === "playing" || (phase === "results" && !session.endedEarly)) && (
        <GameStage
          game={game}
          view={view}
          me={role === "player" ? me : "spectator"}
          sendMove={(move) => send({ type: "move", move })}
          serverNow={serverNow}
        />
      )}

      {phase !== "results" && (
        <Roster
          session={session}
          game={game}
          members={members}
          me={me}
          hostId={hostId}
          onBan={ban}
        />
      )}

      {phase === "setup" && (
        <BottomBar>
          {isHost ? (
            <>
              <Button
                variant="destructive"
                size="xl"
                className="px-4"
                aria-label="Cancel the game and take everyone back to the room"
                onClick={() =>
                  setConfirm({
                    title: "Cancel this game?",
                    body: "Everyone goes back to the room, and players will have to join again when you pick a game.",
                    action: "Cancel game",
                    keep: "Keep setting up",
                    run: () => send({ type: "game.returnToRoom" }),
                  })
                }
              >
                <LogOutIcon className="size-5" /> Cancel
              </Button>
              <Button
                size="xl"
                className="flex-1"
                disabled={startProblem !== null || !live}
                onClick={() => send({ type: "game.start" })}
              >
                <PlayIcon className="size-5" />
                {startProblem ?? "Start game"}
              </Button>
            </>
          ) : (
            <>
              {/* One action: the switch to the other role. The badge above shows the current one. */}
              <Button
                variant="destructive"
                size="xl"
                className="px-4"
                aria-label="Leave the game and stay in the room"
                onClick={() => send({ type: "game.leave" })}
              >
                <LogOutIcon className="size-5" /> Leave
              </Button>
              {role === "player" ? (
                <Button
                  size="xl"
                  className="flex-1"
                  onClick={() => send({ type: "game.spectate" })}
                >
                  <EyeIcon className="size-5" /> Spectate
                </Button>
              ) : (
                <Button
                  size="xl"
                  className="flex-1"
                  disabled={session.banned.includes(me) || full}
                  onClick={() => send({ type: "game.join" })}
                >
                  <PlayIcon className="size-5" />
                  {session.banned.includes(me) ? "Can't join" : full ? "Game is full" : "Join game"}
                </Button>
              )}
            </>
          )}
        </BottomBar>
      )}

      {phase === "playing" && role === "spectator" && (
        <BottomBar>
          <Button
            variant="destructive"
            size="xl"
            className="flex-1"
            aria-label="Stop spectating and go back to the room"
            onClick={() => send({ type: "game.leave" })}
          >
            <LogOutIcon className="size-5" /> Leave
          </Button>
        </BottomBar>
      )}

      {phase === "results" && (
        <BottomBar>
          {isHost ? (
            <>
              <Button
                variant="outline"
                size="xl"
                className="px-4"
                onClick={() => send({ type: "game.returnToRoom" })}
              >
                <ArrowLeftIcon className="size-5" />
                Room
              </Button>
              <Button size="xl" className="flex-1" onClick={() => send({ type: "game.playAgain" })}>
                <RotateCcwIcon className="size-5" /> Play again
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="xl"
                className="px-4"
                onClick={() => send({ type: "game.leave" })}
              >
                <ArrowLeftIcon className="size-5" />
                Room
              </Button>
              <p className="flex h-14 flex-1 items-center justify-center rounded-xl bg-muted px-4 text-center text-sm text-muted-foreground">
                Waiting for the host to play again
              </p>
            </>
          )}
        </BottomBar>
      )}

      <Dialog open={choosingGame} onOpenChange={setChoosingGame}>
        <DialogContent className="p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold">Change game</DialogTitle>
          </DialogHeader>
          <GameList
            pickedId={session.gameId}
            onPick={(gameId) => {
              send({ type: "game.pick", gameId });
              setChoosingGame(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{confirm?.keep ?? "Cancel"}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => confirm?.run()}>
              {confirm?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
