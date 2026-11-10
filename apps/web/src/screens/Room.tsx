import { type Me, type RoomPlayer, canRemovePlayer } from "@playden/protocol";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@playden/ui/components/dropdown-menu";
import { Skeleton } from "@playden/ui/components/skeleton";
import { toast } from "@playden/ui/components/sonner";
import { cn } from "@playden/ui/lib/utils";
import {
  CopyIcon,
  CrownIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  Share2Icon,
  UserMinusIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { RoomCodeTiles } from "../components/RoomCodeTiles";
import { forgetCreatedHere, wasCreatedHere } from "../room/earlySocket";
import { orderPlayers } from "../room/orderPlayers";
import { type ConnectionStatus, type RoomNotice, useRoomSocket } from "../room/useRoomSocket";
import { navigate } from "../router";
import { BottomBar, Centered, Panel } from "../Shell";

const STATUS: Record<ConnectionStatus, { label: string; dot: string }> = {
  connecting: { label: "Connecting", dot: "bg-warning" },
  live: { label: "Live", dot: "bg-success" },
  reconnecting: { label: "Reconnecting", dot: "bg-warning animate-pulse" },
  missing: { label: "Closed", dot: "bg-muted-foreground" },
  removed: { label: "Removed", dot: "bg-muted-foreground" },
};

function roomLink(code: string) {
  return `${window.location.origin}/r/${code}`;
}

async function copyLink(code: string) {
  try {
    await navigator.clipboard.writeText(roomLink(code));
    toast.success("Link copied. Paste it in the group.");
  } catch {
    toast.info(roomLink(code));
  }
}

async function shareRoom(code: string) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "PlayDen",
        text: `Join my PlayDen room ${code}`,
        url: roomLink(code),
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  await copyLink(code);
}

function RoomEnded({ code, title, children }: { code: string; title: string; children: string }) {
  return (
    <Centered>
      <div className="flex flex-col gap-6">
        <RoomCodeTiles code={code} decorative className="opacity-50 grayscale" />
        <div>
          <h1 className="text-[2rem] leading-tight font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 max-w-prose text-muted-foreground">{children}</p>
        </div>
        <Button size="lg" className="self-start" onClick={() => navigate("/")}>
          Back to the lobby
        </Button>
      </div>
    </Centered>
  );
}

/** Tells everyone when the host changes hands; the first host of a visit is not news. */
function useHostChangeToast(hostId: string | null, players: RoomPlayer[], myId: string) {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (!hostId) return;
    const before = previous.current;
    previous.current = hostId;
    if (!before || before === hostId) return;
    if (hostId === myId) {
      toast.info("You're the host now.");
    } else {
      const name = players.find((player) => player.id === hostId)?.name;
      if (name) toast.info(`${name} is the host now.`);
    }
  }, [hostId, players, myId]);
}

function showNotice(notice: RoomNotice) {
  if (notice.type === "removed") toast.info(`${notice.name} was removed from the room.`);
  else toast.error(notice.reason);
}

function PlayerRow({
  player,
  me,
  hostId,
  onRemove,
}: {
  player: RoomPlayer;
  me: Me;
  hostId: string | null;
  onRemove?: () => void;
}) {
  const isMe = player.id === me.id;
  return (
    <li
      className={cn(
        "flex items-center gap-3 py-3 duration-300 animate-in fade-in-0",
        isMe && "-mx-3 my-1 rounded-xl border-none bg-primary/15 px-3 first:mt-0",
      )}
    >
      <PlayerAvatar id={player.id} name={player.name} />
      <span className={cn("flex-1 truncate", isMe ? "font-semibold" : "font-medium")}>
        {player.name}
      </span>
      {player.id === hostId && (
        <Badge
          variant="outline"
          className="h-6 gap-1 px-2 text-sm duration-300 animate-in fade-in-0 zoom-in-90"
        >
          <CrownIcon className="size-3.5! text-warning" /> Host
        </Badge>
      )}
      {isMe && <Badge className="h-6 px-2 text-sm">You</Badge>}
      {onRemove && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="-my-1 text-muted-foreground"
              aria-label={`More for ${player.name}`}
            >
              <MoreHorizontalIcon className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem variant="destructive" className="h-10" onSelect={onRemove}>
              <UserMinusIcon /> Remove from room
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

const PLACEHOLDER_ROWS = 2;

function PlaceholderRow() {
  return (
    <li className="flex items-center gap-3 py-3" aria-hidden>
      <Skeleton className="size-8 rounded-full" />
      <Skeleton className="h-4 w-32" />
    </li>
  );
}

export function Room({ me, code, onRefused }: { me: Me; code: string; onRefused: () => void }) {
  const handlers = useMemo(() => ({ onRefused, onNotice: showNotice }), [onRefused]);
  // A room you just created has only you in it, with you as host: show that at once.
  const [initial] = useState(() =>
    wasCreatedHere(code)
      ? {
          players: [
            { id: me.id, name: me.displayName ?? "You", connected: true, isAdmin: me.isAdmin },
          ],
          hostId: me.id,
        }
      : undefined,
  );
  useEffect(() => forgetCreatedHere(code), [code]);
  const { status, players, hostId, removePlayer } = useRoomSocket(code, me.id, handlers, initial);
  const [removing, setRemoving] = useState<RoomPlayer | null>(null);
  const { label, dot } = STATUS[status];
  const joining = hostId === null;
  const alone = players.length <= 1;
  // Until the room answers, show yourself (you're joining) and placeholders, never "0 players".
  // Rows are keyed by player, so your own row stays put when the real list replaces this.
  const rows = joining
    ? [{ id: me.id, name: me.displayName ?? "You", connected: true, isAdmin: me.isAdmin }]
    : orderPlayers(players, me.id);
  useHostChangeToast(hostId, players, me.id);

  if (status === "missing") {
    return (
      <RoomEnded code={code} title="Room not found">
        This room has ended, or the link is wrong. Rooms close a minute after everyone leaves. Ask
        the group for a new link, or start your own room.
      </RoomEnded>
    );
  }
  if (status === "removed") {
    return (
      <RoomEnded code={code} title="You were removed from this room">
        The host or an admin took you out of this room, so you can't rejoin it. You can still start
        your own room or join another one.
      </RoomEnded>
    );
  }

  const canRemove = (player: RoomPlayer) =>
    hostId !== null &&
    status === "live" &&
    canRemovePlayer({ id: me.id, isAdmin: me.isAdmin }, player, hostId);

  return (
    <>
      <div className="flex flex-col gap-4 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-muted-foreground">Room code</h1>
            <button
              type="button"
              onClick={() => void copyLink(code)}
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              aria-label="Copy room link"
            >
              <CopyIcon className="size-4" /> Copy
            </button>
          </div>
          <span className="flex items-center gap-2 text-sm font-medium" role="status">
            <span aria-hidden className={`size-2.5 rounded-full transition-colors ${dot}`} />
            {label}
          </span>
        </div>
        <RoomCodeTiles code={code} />
      </div>

      <Panel className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Players</h2>
          {joining ? (
            <Skeleton className="h-5 w-16" />
          ) : (
            <span className="text-sm text-muted-foreground duration-300 animate-in fade-in-0">
              {players.length} {players.length === 1 ? "player" : "players"}
            </span>
          )}
        </div>
        <ul className="mt-3 divide-y">
          {rows.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              me={me}
              hostId={hostId}
              onRemove={canRemove(player) ? () => setRemoving(player) : undefined}
            />
          ))}
          {joining &&
            Array.from({ length: PLACEHOLDER_ROWS }, (_, row) => (
              <PlaceholderRow key={`placeholder-${row}`} />
            ))}
        </ul>
        {alone && status === "live" && (
          <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground duration-300 animate-in fade-in-0">
            You're the first one here. Invite the group, and they'll show up in this list as they
            join.
          </p>
        )}
      </Panel>

      <BottomBar>
        <Button variant="outline" size="xl" className="px-4" onClick={() => navigate("/")}>
          <LogOutIcon className="size-5" />
          Leave
        </Button>
        <Button size="xl" className="flex-1" onClick={() => void shareRoom(code)}>
          <Share2Icon className="size-5" /> Invite players
        </Button>
      </BottomBar>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They leave the room straight away, even mid-game, and can't rejoin it until it closes.
              Their account isn't affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing) removePlayer(removing.id);
              }}
            >
              Remove {removing?.name}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
