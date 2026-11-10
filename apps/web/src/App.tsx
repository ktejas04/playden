import { Shell } from "./Shell";
import { useRoute } from "./router";

export function App() {
  const route = useRoute();

  switch (route.name) {
    case "home":
      return <Shell>Home</Shell>;
    case "room":
      return <Shell>Room {route.code}</Shell>;
    case "admin":
      return <Shell>Admin</Shell>;
    case "notFound":
      return <Shell>Page not found.</Shell>;
  }
}
