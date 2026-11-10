import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { GoogleAuth, GoogleIdentity } from "../src/auth/google";

const ORIGIN = "https://playden.test";
const NOW = 1_700_000_000_000;

function fakeGoogle(identity: GoogleIdentity): GoogleAuth {
  return {
    authorizationUrl: (redirectUri, state) =>
      new URL(`https://accounts.google.test/auth?state=${state}&redirect_uri=${redirectUri}`),
    exchange: async () => identity,
  };
}

function makeApp(identity: GoogleIdentity) {
  const app = createApp({ google: () => fakeGoogle(identity), now: () => NOW });
  const testEnv = { ...env, ADMIN_EMAILS: "admin@example.com" };
  return (path: string, init?: RequestInit) =>
    app.fetch(new Request(`${ORIGIN}${path}`, init), testEnv);
}

function cookiesFrom(response: Response): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(";");
    const [name, value] = (pair ?? "").split("=");
    if (name) cookies.set(name, value ?? "");
  }
  return cookies;
}

async function signIn(identity: GoogleIdentity, loginPath = "/auth/login") {
  const fetchApp = makeApp(identity);
  const login = await fetchApp(loginPath);
  const loginCookies = cookiesFrom(login);
  const state = loginCookies.get("pd_oauth_state") ?? "";
  const cookie = [...loginCookies].map(([name, value]) => `${name}=${value}`).join("; ");
  const callback = await fetchApp(`/auth/callback?code=c&state=${state}`, {
    headers: { cookie },
  });
  return { fetchApp, login, callback, session: cookiesFrom(callback).get("pd_session") };
}

const asha: GoogleIdentity = { sub: "g-asha", email: "asha@example.com", emailVerified: true };

describe("Google sign-in", () => {
  it("/auth/login redirects to Google with a state cookie", async () => {
    const response = await makeApp(asha)("/auth/login");
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("state")).toBe(cookiesFrom(response).get("pd_oauth_state"));
    expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/callback`);
  });

  it("callback with a wrong state returns 400 and no session", async () => {
    const fetchApp = makeApp(asha);
    const response = await fetchApp("/auth/callback?code=c&state=wrong", {
      headers: { cookie: "pd_oauth_state=right; pd_oauth_verifier=v" },
    });
    expect(response.status).toBe(400);
    expect(cookiesFrom(response).has("pd_session")).toBe(false);
  });

  it("callback with a missing state returns 400", async () => {
    const response = await makeApp(asha)("/auth/callback?code=c");
    expect(response.status).toBe(400);
  });

  it("callback creates a pending user and a session", async () => {
    const { callback, session, fetchApp } = await signIn(asha);
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/");
    expect(session).toBeTruthy();

    const me = await fetchApp("/api/me", { headers: { cookie: `pd_session=${session}` } });
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({
      email: "asha@example.com",
      status: "pending",
      isAdmin: false,
    });
  });

  it("returns to the page the sign-in started from", async () => {
    const { callback } = await signIn(
      { sub: "g-next", email: "next@example.com", emailVerified: true },
      `/auth/login?next=${encodeURIComponent("/r/ABCD")}`,
    );
    expect(callback.headers.get("location")).toBe("/r/ABCD");
  });

  it.each(["//evil.test", "https://evil.test/r/ABCD", "/\\evil.test", "r/ABCD", "/auth/login"])(
    "ignores an unsafe return path %s",
    async (next) => {
      const { callback } = await signIn(
        { sub: "g-unsafe", email: "unsafe@example.com", emailVerified: true },
        `/auth/login?next=${encodeURIComponent(next)}`,
      );
      expect(callback.headers.get("location")).toBe("/");
    },
  );

  it("an admin email arrives approved", async () => {
    const { session, fetchApp } = await signIn({
      sub: "g-admin",
      email: "Admin@Example.com",
      emailVerified: true,
    });
    const me = await fetchApp("/api/me", { headers: { cookie: `pd_session=${session}` } });
    expect(await me.json()).toMatchObject({ status: "approved", isAdmin: true });
  });

  it("rejects an unverified Google email", async () => {
    const { callback, session } = await signIn({
      sub: "g-unverified",
      email: "x@example.com",
      emailVerified: false,
    });
    expect(callback.status).toBe(403);
    expect(session).toBeUndefined();
  });

  it("/api/me returns 401 without a session", async () => {
    const response = await makeApp(asha)("/api/me");
    expect(response.status).toBe(401);
  });

  it("logout ends the session", async () => {
    const { session, fetchApp } = await signIn({
      sub: "g-logout",
      email: "out@example.com",
      emailVerified: true,
    });
    const cookie = `pd_session=${session}`;
    const logout = await fetchApp("/auth/logout", { method: "POST", headers: { cookie } });
    expect(logout.status).toBe(204);
    expect((await fetchApp("/api/me", { headers: { cookie } })).status).toBe(401);
  });
});
