import type { Me } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import { Toaster, toast } from "@playden/ui/components/sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@playden/ui/components/sheet";
import { ThemeProvider } from "@playden/ui/components/theme-provider";
import { useState } from "react";
import { AccountMenu } from "./AccountMenu";
import { signOut } from "./api";
import { type Route, navigate, useRoute } from "./router";
import { Admin, MEMBERS_SUBTITLE, MembersManager } from "./screens/Admin";
import { Banned } from "./screens/Banned";
import { Declined } from "./screens/Declined";
import { Home } from "./screens/Home";
import { Privacy } from "./screens/Privacy";
import { Profile } from "./screens/Profile";
import { Room } from "./screens/Room";
import { SignIn } from "./screens/SignIn";
import { Waiting } from "./screens/Waiting";
import { Centered, Shell } from "./Shell";
import { useMe } from "./useMe";

export function App() {
  return (
    <ThemeProvider>
      <Gate />
      <Toaster position="top-center" />
    </ThemeProvider>
  );
}

function Gate() {
  const route = useRoute();
  const { state, reload, setMe } = useMe();
  const [membersOpen, setMembersOpen] = useState(false);

  if (route.name === "privacy") {
    return (
      <Shell back>
        <Privacy />
      </Shell>
    );
  }

  if (state.status === "loading") {
    return (
      <Shell>
        <Centered>
          <p className="text-muted-foreground">Loading…</p>
        </Centered>
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell>
        <Centered>
          <div className="flex flex-col items-center gap-4 text-center">
            <p>{state.message}</p>
            <Button size="lg" className="h-11" onClick={() => void reload()}>
              Try again
            </Button>
          </div>
        </Centered>
      </Shell>
    );
  }

  const { me } = state;
  if (!me) {
    return (
      <Shell>
        <SignIn />
      </Shell>
    );
  }

  async function handleSignOut() {
    try {
      await signOut();
      setMe(null);
      navigate("/");
    } catch {
      toast.error("Couldn't sign out. Try again.");
    }
  }

  // Leaving a room page drops its socket, so in a room Members opens over it instead.
  function openMembers() {
    if (route.name === "room") setMembersOpen(true);
    else navigate("/admin");
  }

  const canPlay = Boolean(me.displayName) && (me.isAdmin || me.status === "approved");
  return (
    <Shell
      back={canPlay && route.name !== "home"}
      headerRight={
        <AccountMenu me={me} onOpenMembers={openMembers} onSignOut={() => void handleSignOut()} />
      }
    >
      {screenFor(me, route, setMe, reload)}
      {me.isAdmin && (
        <Sheet open={membersOpen && route.name === "room"} onOpenChange={setMembersOpen}>
          <SheetContent className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
            <SheetHeader className="px-5 pt-5 pb-2">
              <SheetTitle className="text-2xl font-bold tracking-tight">Members</SheetTitle>
              <SheetDescription className="text-base">{MEMBERS_SUBTITLE}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-5 pt-3 pb-8">
              <MembersManager />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Shell>
  );
}

function screenFor(me: Me, route: Route, setMe: (me: Me) => void, reload: () => Promise<void>) {
  if (!me.displayName) return <Profile me={me} onSaved={setMe} />;
  if (!me.isAdmin && me.status === "banned") return <Banned />;
  if (!me.isAdmin && me.status === "declined") return <Declined me={me} onUpdated={setMe} />;
  if (!me.isAdmin && me.status === "pending") return <Waiting onCheckAgain={() => void reload()} />;

  switch (route.name) {
    case "home":
      return <Home me={me} />;
    case "room":
      return <Room key={route.code} me={me} code={route.code} />;
    case "admin":
      return me.isAdmin ? <Admin /> : <NotFound />;
    case "privacy":
      return <Privacy />;
    case "notFound":
      return <NotFound />;
  }
}

function NotFound() {
  return (
    <Centered>
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-medium">This page doesn't exist.</p>
        <Button size="lg" className="h-11" onClick={() => navigate("/")}>
          Back to the lobby
        </Button>
      </div>
    </Centered>
  );
}
