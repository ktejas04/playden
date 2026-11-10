import type { Me } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@playden/ui/components/card";
import { Input } from "@playden/ui/components/input";
import { Label } from "@playden/ui/components/label";
import { toast } from "@playden/ui/components/sonner";
import { type FormEvent, useState } from "react";
import { createRoom } from "../api";
import { normalizeJoinCode } from "../room/joinCode";
import { navigate } from "../router";
import { BottomBar } from "../Shell";

export function Home({ me }: { me: Me }) {
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function create() {
    setCreating(true);
    try {
      const { code } = await createRoom();
      navigate(`/r/${code}`);
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : "Couldn't create a room");
      setCreating(false);
    }
  }

  function join(event: FormEvent) {
    event.preventDefault();
    const code = normalizeJoinCode(joinCode);
    if (!code) {
      setJoinError("Room codes are 4 letters, like KMPT");
      return;
    }
    navigate(`/r/${code}`);
  }

  return (
    <>
      <div className="flex flex-col gap-4 py-4">
        <h1 className="text-2xl font-semibold">Hi {me.displayName}</h1>
        <Card>
          <CardHeader>
            <CardTitle>Join a room</CardTitle>
            <CardDescription>Got a code or link from the group? Enter it here.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={join} className="flex flex-col gap-3">
              <Label htmlFor="joinCode" className="sr-only">
                Room code
              </Label>
              <div className="flex gap-2">
                <Input
                  id="joinCode"
                  className="h-11 text-lg tracking-widest uppercase"
                  placeholder="ABCD"
                  autoCapitalize="characters"
                  autoComplete="off"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value);
                    setJoinError(null);
                  }}
                />
                <Button type="submit" variant="secondary" size="lg" className="h-11 px-5">
                  Join
                </Button>
              </div>
              {joinError && (
                <p role="alert" className="text-sm text-destructive">
                  {joinError}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
      <BottomBar>
        <Button
          size="lg"
          className="h-12 flex-1 text-base"
          disabled={creating}
          onClick={() => void create()}
        >
          {creating ? "Creating…" : "Create a room"}
        </Button>
      </BottomBar>
    </>
  );
}
