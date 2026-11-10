import type { Me } from "@playden/protocol";
import { Avatar, AvatarFallback } from "@playden/ui/components/avatar";
import { Badge } from "@playden/ui/components/badge";
import { Button } from "@playden/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@playden/ui/components/card";
import { toast } from "@playden/ui/components/sonner";
import { CopyIcon, Share2Icon } from "lucide-react";
import { initials } from "../initials";
import { type ConnectionStatus, useRoomSocket } from "../room/useRoomSocket";
import { navigate } from "../router";
import { BottomBar } from "../Shell";

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
    toast.success("Link copied");
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

  return (
    <>
      <Card className="mt-4">
        <CardContent className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Room code</p>
            <p className="font-mono text-4xl font-bold tracking-[0.25em]">{code}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline" className="gap-1.5">
              <span aria-hidden className={`size-2 rounded-full ${dot}`} />
              {label}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => void copyLink(code)}>
              <CopyIcon /> Copy link
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Players <Badge variant="secondary">{players.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-muted-foreground">Waiting for players…</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {players.map((player) => (
                <li key={player.id} className="flex items-center gap-3 rounded-lg py-1.5">
                  <Avatar>
                    <AvatarFallback className="bg-primary/15 text-primary">
                      {initials(player.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate font-medium">{player.name}</span>
                  {player.id === me.id && <Badge variant="secondary">You</Badge>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="mt-4 px-1 text-sm text-muted-foreground">
        Send the link to the group. Games arrive in the next update.
      </p>

      <BottomBar>
        <Button variant="outline" size="lg" className="h-12 px-5" onClick={() => navigate("/")}>
          Leave
        </Button>
        <Button size="lg" className="h-12 flex-1 text-base" onClick={() => void shareRoom(code)}>
          <Share2Icon /> Invite players
        </Button>
      </BottomBar>
    </>
  );
}
