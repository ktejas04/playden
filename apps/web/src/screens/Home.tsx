import type { Me } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import { Label } from "@playden/ui/components/label";
import { toast } from "@playden/ui/components/sonner";
import { ChevronRightIcon, PlusIcon, UsersIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { createRoom, listUsers, roomExists } from "../api";
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

/** Admins see who is waiting right on the lobby, so approvals don't get missed. */
function AdminShortcut() {
  const [waiting, setWaiting] = useState<number | null>(null);

  useEffect(() => {
    listUsers("pending")
      .then((users) => setWaiting(users.length))
      .catch(() => setWaiting(null));
  }, []);

  const text =
    waiting === null || waiting === 0
      ? "Members"
      : `${waiting} ${waiting === 1 ? "person is" : "people are"} waiting to join`;

  return (
    <button
      type="button"
      onClick={() => navigate("/admin")}
      className="group mt-3 flex w-full cursor-pointer items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
    >
      <span className="relative grid size-9 place-items-center rounded-full bg-secondary">
        <UsersIcon className="size-4" />
        {waiting !== null && waiting > 0 && (
          <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
            {waiting}
          </span>
        )}
      </span>
      <span className="flex-1 font-medium">{text}</span>
      <span className="flex items-center text-sm text-muted-foreground transition-colors group-hover:text-foreground">
        {waiting ? "Review" : "Manage"}
        <ChevronRightIcon className="size-4" />
      </span>
    </button>
  );
}

export function Home({ me }: { me: Me }) {
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
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

  async function submit(event: FormEvent) {
    event.preventDefault();
    const code = normalizeJoinCode(joinCode);
    if (!code) {
      setJoinError("That code has a letter we never use (I, L or O). Check it and try again.");
      return;
    }
    setChecking(true);
    try {
      if (await roomExists(code)) {
        navigate(`/r/${code}`);
        return;
      }
      setJoinError(`Room not found. There's no open room called ${code}; check the code.`);
    } catch (failure) {
      setJoinError(failure instanceof Error ? failure.message : "Couldn't check that room");
    } finally {
      setChecking(false);
    }
  }

  const firstName = me.displayName?.split(/\s+/)[0] ?? "";

  return (
    <>
      <PageTitle
        title={`${greeting(new Date().getHours())}, ${firstName}`}
        subtitle="Start a room for tonight, or join the one your friends made."
      />

      {me.isAdmin && <AdminShortcut />}

      <Panel className="mt-6">
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
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
          />
          {joinError && (
            <p role="alert" className="text-sm text-destructive">
              {joinError}
            </p>
          )}
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            disabled={joinCode.length < 4 || checking}
          >
            {checking ? "Checking…" : "Join room"}
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
