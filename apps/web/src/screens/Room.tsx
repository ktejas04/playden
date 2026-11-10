import type { Me } from "@playden/protocol";
import { Badge } from "@playden/ui/components/badge";
import { Button } from "@playden/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@playden/ui/components/card";
import { toast } from "@playden/ui/components/sonner";
import { type ConnectionStatus, useRoomSocket } from "../room/useRoomSocket";
import { navigate } from "../router";
import { BottomBar } from "../Shell";

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
};

async function shareRoom(code: string) {
  const url = `${window.location.origin}/r/${code}`;
  const text = `Join my PlayDen room ${code}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: "PlayDen", text, url });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  } catch {
    toast.info(url);
  }
}

export function Room({ me, code }: { me: Me; code: string }) {
  const { status, players } = useRoomSocket(code);

  return (
    <>
      <div className="flex flex-col gap-4 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Room code</p>
            <p className="font-mono text-4xl font-bold tracking-[0.2em]">{code}</p>
          </div>
          <Badge variant={status === "live" ? "secondary" : "outline"}>
            {STATUS_LABEL[status]}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>In the room ({players.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {players.length === 0 ? (
              <p className="text-muted-foreground">Waiting for players…</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {players.map((player) => (
                  <li key={player.id} className="flex items-center gap-3 py-3">
                    <span
                      aria-hidden
                      className={`size-2.5 rounded-full ${player.connected ? "bg-emerald-500" : "bg-muted-foreground"}`}
                    />
                    <span className="flex-1 truncate">{player.name}</span>
                    {player.id === me.id && <Badge variant="outline">You</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <p className="text-sm text-muted-foreground">
          Share the link in the group. Games arrive in the next phase.
        </p>
      </div>
      <BottomBar>
        <Button variant="outline" size="lg" className="h-12" onClick={() => navigate("/")}>
          Leave
        </Button>
        <Button size="lg" className="h-12 flex-1 text-base" onClick={() => void shareRoom(code)}>
          Invite players
        </Button>
      </BottomBar>
    </>
  );
}
