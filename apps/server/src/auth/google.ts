import { Google, decodeIdToken } from "arctic";
import { z } from "zod";
import type { Env } from "../env";

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export interface GoogleAuth {
  authorizationUrl(redirectUri: string, state: string, codeVerifier: string): URL;
  exchange(redirectUri: string, code: string, codeVerifier: string): Promise<GoogleIdentity>;
}

const SCOPES = ["openid", "email", "profile"];

const idTokenClaims = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  email_verified: z.boolean().optional(),
});

// The ID token comes straight from Google's token endpoint over TLS, so its
// signature does not need to be re-verified here.
export function createGoogleAuth(env: Env): GoogleAuth {
  const client = (redirectUri: string) =>
    new Google(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
  return {
    authorizationUrl(redirectUri, state, codeVerifier) {
      return client(redirectUri).createAuthorizationURL(state, codeVerifier, SCOPES);
    },
    async exchange(redirectUri, code, codeVerifier) {
      const tokens = await client(redirectUri).validateAuthorizationCode(code, codeVerifier);
      const claims = idTokenClaims.parse(decodeIdToken(tokens.idToken()));
      return {
        sub: claims.sub,
        email: claims.email,
        emailVerified: claims.email_verified === true,
      };
    },
  };
}
