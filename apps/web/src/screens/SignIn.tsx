import { profileSchema } from "@playden/protocol";
import { Badge } from "@playden/ui/components/badge";
import { Button } from "@playden/ui/components/button";
import { Input } from "@playden/ui/components/input";
import { Label } from "@playden/ui/components/label";
import { type FormEvent, useEffect, useState } from "react";
import { devSignIn, devSignInEnabled } from "../api";
import { RoomCodeTiles } from "../components/RoomCodeTiles";
import { Centered, Panel } from "../Shell";

const TEST_PLAYERS = ["Asha", "Ben", "Chi", "Dev", "Esha", "Faiz"];

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function loginHref(): string {
  const { pathname, search, hash } = window.location;
  const here = pathname + search + hash;
  return here === "/" ? "/auth/login" : `/auth/login?next=${encodeURIComponent(here)}`;
}

function TestPlayerSignIn() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInAs(candidate: string) {
    const parsed = profileSchema.shape.displayName.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await devSignIn(parsed.data);
      window.location.reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Something went wrong");
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void signInAs(name);
  }

  return (
    <Panel className="flex flex-col gap-4 border-dashed">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Test player</h2>
        <Badge variant="outline">Local only</Badge>
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        Sign in without Google to test on this computer or your Wi-Fi. Each address or private
        window keeps its own player.
      </p>
      <div className="flex flex-wrap gap-2">
        {TEST_PLAYERS.map((player) => (
          <Button
            key={player}
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void signInAs(player)}
          >
            {player}
          </Button>
        ))}
      </div>
      <form onSubmit={submit} className="flex flex-col gap-2">
        <Label htmlFor="testPlayerName">Or any name</Label>
        <div className="flex gap-2">
          <Input
            id="testPlayerName"
            className="h-11 rounded-xl text-base"
            autoComplete="off"
            placeholder="Test name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="lg" className="h-11" disabled={busy}>
            Sign in
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </Panel>
  );
}

export function SignIn() {
  const [devEnabled, setDevEnabled] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let active = true;
    void devSignInEnabled().then((enabled) => {
      if (active) setDevEnabled(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Centered>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <RoomCodeTiles code="PLAY" decorative className="mb-2 -rotate-2" />
          <h1 className="text-[2.5rem] leading-[1.05] font-bold tracking-tight">
            Game nights for our group, all in one place.
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            Make a room, share the code in WhatsApp, and play from any phone or laptop.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Button asChild variant="outline" size="xl" className="w-full">
            <a href={loginHref()}>
              <GoogleMark />
              Continue with Google
            </a>
          </Button>
          <p className="text-sm text-muted-foreground">
            New here? After you sign in, an admin lets you in. Read how we handle your data in our{" "}
            <a href="/privacy" className="text-foreground">
              privacy note
            </a>
            .
          </p>
        </div>
        {/* Vite drops this from production builds, so the card never ships (D48). */}
        {import.meta.env.DEV && devEnabled && <TestPlayerSignIn />}
      </div>
    </Centered>
  );
}
