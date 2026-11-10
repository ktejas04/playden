import type { Me } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import { Label } from "@playden/ui/components/label";
import { toast } from "@playden/ui/components/sonner";
import { PlusIcon } from "lucide-react";
import { type FormEvent, useState } from "react";
import { createRoom } from "../api";
import { JoinCodeInput } from "../components/JoinCodeInput";
import { normalizeJoinCode } from "../room/joinCode";
import { navigate } from "../router";
import { BottomBar, PageTitle, Panel } from "../Shell";

function greeting(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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

  function join(code: string) {
    const valid = normalizeJoinCode(code);
    if (!valid) {
      setJoinError("That code has a letter we never use (I, L or O). Check it and try again.");
      return;
    }
    navigate(`/r/${valid}`);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    join(joinCode);
  }

  const firstName = me.displayName?.split(/\s+/)[0] ?? "";

  return (
    <>
      <PageTitle
        title={`${greeting(new Date().getHours())}, ${firstName}`}
        subtitle="Start a room for tonight, or join the one your friends made."
      />

      <Panel className="mt-6">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="joinCode" className="font-heading text-lg font-semibold">
              Join a room
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Type the 4-letter code, or paste the link from WhatsApp.
            </p>
          </div>
          <JoinCodeInput
            value={joinCode}
            invalid={Boolean(joinError)}
            onChange={(code) => {
              setJoinCode(code);
              setJoinError(null);
            }}
            onComplete={join}
          />
          {joinError && (
            <p role="alert" className="text-sm text-destructive">
              {joinError}
            </p>
          )}
          <Button type="submit" variant="secondary" size="lg" disabled={joinCode.length < 4}>
            Join room
          </Button>
        </form>
      </Panel>

      <BottomBar>
        <Button size="xl" className="flex-1" disabled={creating} onClick={() => void create()}>
          <PlusIcon className="size-5" />
          {creating ? "Creating room…" : "Create a room"}
        </Button>
      </BottomBar>
    </>
  );
}
