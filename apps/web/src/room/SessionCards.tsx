import { type Seat, seatForNewcomer } from "@playden/engine";
import { type GameSession, activePlayers } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@playden/ui/components/dialog";
import { EyeIcon, PlayIcon } from "lucide-react";
import type { WebGame } from "../games";
import { Panel } from "../Shell";

/** The session's active players as engine seats. */
export function seatsOf(session: GameSession): Seat[] {
  return activePlayers(session).map(({ id, name, team }) =>
    team === undefined ? { id, name } : { id, name, team },
  );
}

/** No seat left for a newcomer (every team full in team games). */
export function isFull(game: WebGame, session: GameSession): boolean {
  return seatForNewcomer(game.definition, seatsOf(session), { id: "", name: "" }) === null;
}

/** Why this person can't join right now, or null when they can. */
export function joinBlocker(session: GameSession, myId: string, full: boolean): string | null {
  if (session.banned.includes(myId)) return "You can't play in this game";
  if (full) return "Game is full";
  return null;
}

/**
 * The popup people just in the room get (on arriving too): while a game is set up, Join game
 * or Spectate; once it has started, Spectate. ✕ means "not interested": they stay in the room
 * and can still choose from the card.
 */
export function SessionPrompt({
  open,
  started,
  game,
  hostName,
  blocker,
  onJoin,
  onSpectate,
  onClose,
}: {
  open: boolean;
  started: boolean;
  game: WebGame;
  hostName: string;
  blocker: string | null;
  onJoin: () => void;
  onSpectate: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel="Not interested" className="gap-5 p-6 sm:max-w-sm">
        <DialogHeader className="gap-1.5 pr-8">
          <p className="text-sm font-medium text-muted-foreground">
            {started ? "Game in progress" : `${hostName} is setting up`}
          </p>
          <DialogTitle className="font-heading text-2xl font-bold">
            {game.definition.name}
          </DialogTitle>
          <DialogDescription className="text-base">{game.definition.summary}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-6 -mb-6 flex-col-reverse gap-3 p-6 sm:flex-row">
          <Button
            size="lg"
            variant={started ? "default" : "outline"}
            className="sm:flex-1"
            onClick={onSpectate}
          >
            <EyeIcon /> Spectate
          </Button>
          {!started && (
            <Button size="lg" className="sm:flex-1" disabled={blocker !== null} onClick={onJoin}>
              <PlayIcon /> {blocker ?? "Join game"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** On the room screen, for people just in the room: the game being set up, or in progress. */
export function SessionCard({
  session,
  game,
  blocker,
  onJoin,
  onSpectate,
}: {
  session: GameSession;
  game: WebGame;
  blocker: string | null;
  onJoin: () => void;
  onSpectate: () => void;
}) {
  if (session.phase === "results") return null;
  const setup = session.phase === "setup";
  return (
    <Panel className="mt-4 duration-300 animate-in fade-in-0 slide-in-from-bottom-2">
      <p className="text-sm font-medium text-muted-foreground">
        {setup ? "Setting up" : "Game in progress"}
      </p>
      <h2 className="mt-0.5 font-heading text-xl font-bold">{game.definition.name}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {session.players.filter((p) => !p.left).length} playing
        {session.spectators.length > 0 && ` · ${session.spectators.length} spectating`}
      </p>
      <div className="mt-4 flex gap-3">
        <Button variant={setup ? "outline" : "default"} className="flex-1" onClick={onSpectate}>
          <EyeIcon /> Spectate
        </Button>
        {setup && (
          <Button className="flex-1" disabled={blocker !== null} onClick={onJoin}>
            <PlayIcon /> {blocker ?? "Join game"}
          </Button>
        )}
      </div>
    </Panel>
  );
}
