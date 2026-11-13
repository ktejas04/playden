// Secrets are not in wrangler.toml, so `wrangler types` can't see them.
declare global {
  namespace Cloudflare {
    interface Env {
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      ADMIN_EMAILS: string;
      /** Optional, local testing only: how long an empty room stays open, in ms. */
      ROOM_EMPTY_CLOSE_MS?: string;
      /** Optional: the 3-2-1 before play, in ms (tests set 0). */
      START_COUNTDOWN_MS?: string;
      /** Local testing only: "true" turns on test-player sign-in for local addresses (D48). */
      DEV_LOGIN?: string;
    }
  }
}

export type Env = Cloudflare.Env;
