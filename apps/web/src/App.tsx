import type { Me } from "@playden/protocol";
import { Button } from "@playden/ui/components/button";
import { Toaster, toast } from "@playden/ui/components/sonner";
import { ThemeProvider } from "@playden/ui/components/theme-provider";
import { signOut } from "./api";
import { type Route, navigate, useRoute } from "./router";
import { Banned } from "./screens/Banned";
import { Profile } from "./screens/Profile";
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
  if (!me) return <Shell>{<SignIn />}</Shell>;

  async function handleSignOut() {
    try {
      await signOut();
      setMe(null);
      navigate("/");
    } catch {
      toast.error("Couldn't sign out. Try again.");
    }
  }

  const header = (
    <>
      {me.isAdmin && route.name !== "admin" && (
        <Button variant="ghost" size="lg" onClick={() => navigate("/admin")}>
          Admin
        </Button>
      )}
      <Button variant="ghost" size="lg" onClick={() => void handleSignOut()}>
        Sign out
      </Button>
    </>
  );

  return <Shell headerRight={header}>{screenFor(me, route, setMe, reload)}</Shell>;
}

function screenFor(me: Me, route: Route, setMe: (me: Me) => void, reload: () => Promise<void>) {
  if (!me.displayName) return <Profile me={me} onSaved={setMe} />;
  if (!me.isAdmin && me.status === "banned") return <Banned />;
  if (!me.isAdmin && me.status === "pending") return <Waiting onCheckAgain={() => void reload()} />;

  switch (route.name) {
    case "home":
      return <p className="py-8">Hi {me.displayName}. Rooms arrive in task 010.</p>;
    case "room":
      return <p className="py-8">Room {route.code}</p>;
    case "admin":
      return <p className="py-8">Admin</p>;
    case "notFound":
      return <p className="py-8">Page not found.</p>;
  }
}
