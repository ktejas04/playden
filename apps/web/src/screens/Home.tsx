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
import { ArrowRightIcon, PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { createRoom } from "../api";
import { cleanJoinInput, normalizeJoinCode } from "../room/joinCode";
import { navigate } from "../router";
import { BottomBar, PageTitle } from "../Shell";

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
      <PageTitle
        title={`Hi, ${me.displayName}`}
        subtitle="Start a room for tonight, or join one from the group."
      />
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Join a room</CardTitle>
          <CardDescription>Type the 4-letter code, or paste the link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={join} className="flex flex-col gap-2">
            <Label htmlFor="joinCode" className="sr-only">
              Room code
            </Label>
            <div className="flex gap-2">
              <Input
                id="joinCode"
                className="h-12 flex-1 text-center font-mono text-xl tracking-[0.4em]"
                placeholder="ABCD"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="go"
                value={joinCode}
                aria-invalid={joinError ? true : undefined}
                onChange={(e) => {
                  setJoinCode(cleanJoinInput(e.target.value));
                  setJoinError(null);
                }}
              />
              <Button
                type="submit"
                size="lg"
                variant="secondary"
                className="h-12 px-4"
                disabled={joinCode.length < 4}
                aria-label="Join room"
              >
                Join <ArrowRightIcon />
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
      <BottomBar>
        <Button
          size="lg"
          className="h-12 flex-1 text-base"
          disabled={creating}
          onClick={() => void create()}
        >
          <PlusIcon /> {creating ? "Creating…" : "Create a room"}
        </Button>
      </BottomBar>
    </>
  );
}
