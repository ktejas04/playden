import { generateCodeVerifier, generateState } from "arctic";
import type { Route } from "../app";
import { SESSION_DAYS } from "../config";
import { createSession, deleteSession } from "../db/sessions";
import { upsertGoogleUser } from "../db/users";
import { errorJson } from "../http";
import { isAdminEmail } from "./admins";
import { clearCookie, parseCookies, serializeCookie } from "./cookies";
import { SESSION_COOKIE, sessionToken } from "./session";

const STATE_COOKIE = "pd_oauth_state";
const VERIFIER_COOKIE = "pd_oauth_verifier";
const NEXT_COOKIE = "pd_oauth_next";
const OAUTH_COOKIE_PATH = "/auth";
const OAUTH_COOKIE_SECONDS = 600;

function callbackUrl(url: URL): string {
  return new URL("/auth/callback", url.origin).toString();
}

// Only a path on this site may be a return target; anything else would let a
// crafted sign-in link send people to another site after they sign in.
function returnPath(next: string | null | undefined): string {
  if (!next?.startsWith("/")) return "/";
  const base = "https://playden.invalid";
  const target = new URL(next, base);
  if (target.origin !== base || target.pathname.startsWith("/auth/")) return "/";
  return target.pathname + target.search + target.hash;
}

export const authRoutes: Route[] = [
  {
    method: "GET",
    path: "/auth/login",
    handler: ({ url, env, deps }) => {
      const state = generateState();
      const verifier = generateCodeVerifier();
      const target = deps.google(env).authorizationUrl(callbackUrl(url), state, verifier);
      const headers = new Headers({ location: target.toString() });
      const options = { path: OAUTH_COOKIE_PATH, maxAge: OAUTH_COOKIE_SECONDS };
      headers.append("set-cookie", serializeCookie(STATE_COOKIE, state, options));
      headers.append("set-cookie", serializeCookie(VERIFIER_COOKIE, verifier, options));
      const next = returnPath(url.searchParams.get("next"));
      headers.append("set-cookie", serializeCookie(NEXT_COOKIE, next, options));
      return new Response(null, { status: 302, headers });
    },
  },
  {
    method: "GET",
    path: "/auth/callback",
    handler: async ({ request, url, env, deps, db, now }) => {
      const cookies = parseCookies(request.headers.get("cookie"));
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const verifier = cookies.get(VERIFIER_COOKIE);
      if (!state || !code || !verifier || state !== cookies.get(STATE_COOKIE)) {
        return errorJson(400, "Sign-in expired, please try again");
      }

      const identity = await deps.google(env).exchange(callbackUrl(url), code, verifier);
      if (!identity.emailVerified) return errorJson(403, "Your Google email is not verified");

      const user = await upsertGoogleUser(db, {
        googleSub: identity.sub,
        email: identity.email,
        isAdmin: isAdminEmail(identity.email, env.ADMIN_EMAILS),
        now,
      });
      const { token } = await createSession(db, user.id, now);

      const headers = new Headers({ location: returnPath(cookies.get(NEXT_COOKIE)) });
      headers.append(
        "set-cookie",
        serializeCookie(SESSION_COOKIE, token, { maxAge: SESSION_DAYS * 24 * 60 * 60 }),
      );
      headers.append("set-cookie", clearCookie(STATE_COOKIE, OAUTH_COOKIE_PATH));
      headers.append("set-cookie", clearCookie(VERIFIER_COOKIE, OAUTH_COOKIE_PATH));
      headers.append("set-cookie", clearCookie(NEXT_COOKIE, OAUTH_COOKIE_PATH));
      return new Response(null, { status: 302, headers });
    },
  },
  {
    method: "POST",
    path: "/auth/logout",
    handler: async ({ request, db }) => {
      const token = sessionToken(request);
      if (token) await deleteSession(db, token);
      return new Response(null, {
        status: 204,
        headers: { "set-cookie": clearCookie(SESSION_COOKIE) },
      });
    },
  },
];
