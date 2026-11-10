import type { Me } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import { toast } from "@playden/ui/components/sonner";
import { CopyIcon, LogOutIcon, Share2Icon } from "lucide-react";
import { PlayerAvatar } from "../components/PlayerAvatar";
import { RoomCodeTiles } from "../components/RoomCodeTiles";
import { type ConnectionStatus, useRoomSocket } from "../room/useRoomSocket";
import { navigate } from "../router";
import { BottomBar, Panel } from "../Shell";

const STATUS: Record<ConnectionStatus, { label: string; dot: string }> = {
  connecting: { label: "Connecting", dot: "bg-warning" },
  live: { label: "Live", dot: "bg-success" },
  reconnecting: { label: "Reconnecting", dot: "bg-warning animate-pulse" },
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

export function Room({ me, code }: { me: Me; code: string }) {
  const { status, players } = useRoomSocket(code);
  const { label, dot } = STATUS[status];
  const alone = players.length <= 1;

  return (
    <>
      <div className="flex flex-col gap-4 pt-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-muted-foreground">Room code</h1>
          <span className="flex items-center gap-2 text-sm font-medium" role="status">
            <span aria-hidden className={`size-2.5 rounded-full ${dot}`} />
            {label}
          </span>
        </div>
        <RoomCodeTiles code={code} />
        <Button
          variant="link"
          className="h-8 self-start px-0 text-sm"
          onClick={() => void copyLink(code)}
        >
          <CopyIcon /> Copy room link
        </Button>
      </div>

      <Panel className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Players</h2>
          <span className="text-sm text-muted-foreground">
            {players.length} {players.length === 1 ? "player" : "players"}
          </span>
        </div>
        <ul className="mt-3 divide-y">
          {players.map((player) => (
            <li key={player.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
              <PlayerAvatar id={player.id} name={player.name} />
              <span className="flex-1 truncate font-medium">{player.name}</span>
              {player.id === me.id && <span className="text-sm text-muted-foreground">You</span>}
            </li>
          ))}
        </ul>
        {alone && status === "live" && (
          <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
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
    </>
  );
}
