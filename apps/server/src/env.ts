// Secrets are not in wrangler.toml, so `wrangler types` can't see them.
declare global {
  namespace Cloudflare {
    interface Env {
      GOOGLE_CLIENT_ID: string;
      GOOGLE_CLIENT_SECRET: string;
      ADMIN_EMAILS: string;
    }
  }
}

export type Env = Cloudflare.Env;
