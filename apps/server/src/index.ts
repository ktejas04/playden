import { createApp } from "./app";
import { createGoogleAuth } from "./auth/google";

export default createApp({ google: createGoogleAuth, now: Date.now });
