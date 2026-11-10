import { createApp } from "./app";
import { createGoogleAuth } from "./auth/google";

export { Room } from "./room/Room";

export default createApp({ google: createGoogleAuth, now: Date.now });
