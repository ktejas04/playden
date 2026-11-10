import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { earlyRoomSocket } from "./room/earlySocket";
import { socketBase } from "./room/socketUrl";
import "./index.css";

/** An early room socket the room screen hasn't taken by then is closed. */
const EARLY_SOCKET_GRACE_MS = 10_000;

// Opening a room link starts joining before React and the sign-in check have run.
earlyRoomSocket.start(window.location.pathname, socketBase(window.location));
setTimeout(() => earlyRoomSocket.abandon(), EARLY_SOCKET_GRACE_MS);

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
