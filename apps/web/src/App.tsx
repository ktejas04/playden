import type { Me } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import { Toaster, toast } from "@playden/ui/components/sonner";
import { ThemeProvider } from "@playden/ui/components/theme-provider";
import { AccountMenu } from "./AccountMenu";
import { signOut } from "./api";
import { type Route, navigate, useRoute } from "./router";
import { Admin } from "./screens/Admin";
import { Banned } from "./screens/Banned";
import { Declined } from "./screens/Declined";
import { Home } from "./screens/Home";
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

  const canPlay = Boolean(me.displayName) && (me.isAdmin || me.status === "approved");
  return (
    <Shell
      back={canPlay && route.name !== "home"}
      headerRight={<AccountMenu me={me} onSignOut={() => void handleSignOut()} />}
    >
      {screenFor(me, route, setMe, reload)}
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
