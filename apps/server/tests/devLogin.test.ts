import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { isLocalHost } from "../src/auth/devLogin";
import type { GoogleAuth } from "../src/auth/google";

const NOW = 1_700_000_000_000;

const noGoogle: GoogleAuth = {
  authorizationUrl: () => {
    throw new Error("Google is not used here");
  },
  exchange: () => Promise.reject(new Error("Google is not used here")),
};

function makeApp(devLogin: string | undefined, adminEmails = "admin@example.com") {
  const app = createApp({ google: () => noGoogle, now: () => NOW });
  const testEnv = { ...env, ADMIN_EMAILS: adminEmails, DEV_LOGIN: devLogin };
  return (url: string, init?: RequestInit) => app.fetch(new Request(url, init), testEnv);
}

function signInAs(fetchApp: ReturnType<typeof makeApp>, origin: string, name: unknown) {
  return fetchApp(`${origin}/auth/dev`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

function sessionFrom(response: Response): { value: string; header: string } | undefined {
  const header = response.headers.getSetCookie().find((h) => h.startsWith("pd_session="));
  if (!header) return undefined;
  return { value: header.split(";")[0]?.split("=")[1] ?? "", header };
}

async function meFor(fetchApp: ReturnType<typeof makeApp>, origin: string, session: string) {
  const me = await fetchApp(`${origin}/api/me`, { headers: { cookie: `pd_session=${session}` } });
  return (await me.json()) as Record<string, unknown>;
}

describe("dev test-player sign-in (D48)", () => {
  it("is not found when DEV_LOGIN is unset", async () => {
    const fetchApp = makeApp(undefined);
    expect((await fetchApp("http://localhost:5173/auth/dev")).status).toBe(404);
    expect((await signInAs(fetchApp, "http://localhost:5173", "Asha")).status).toBe(404);
  });

  it("is not found for a public host even when DEV_LOGIN is on", async () => {
    const fetchApp = makeApp("true");
    for (const origin of ["https://playden.example.workers.dev", "http://8.8.8.8"]) {
      expect((await fetchApp(`${origin}/auth/dev`)).status).toBe(404);
      expect((await signInAs(fetchApp, origin, "Asha")).status).toBe(404);
    }
  });

  it("is enabled for localhost and a home network address", async () => {
    const fetchApp = makeApp("true");
    for (const origin of ["http://localhost:5173", "http://192.168.1.5:5173"]) {
      const response = await fetchApp(`${origin}/auth/dev`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ enabled: true });
    }
  });

  it("signs in an approved test player with the given name", async () => {
    const fetchApp = makeApp("true");
    const response = await signInAs(fetchApp, "http://localhost:5173", "Asha");
    expect(response.status).toBe(204);
    const session = sessionFrom(response);
    expect(session?.value).toBeTruthy();
    expect(await meFor(fetchApp, "http://localhost:5173", session?.value ?? "")).toMatchObject({
      displayName: "Asha",
      invitedBy: "test",
      email: "asha@dev.playden.invalid",
      status: "approved",
      isAdmin: false,
    });
  });

  it("reuses the same account for the same name", async () => {
    const fetchApp = makeApp("true");
    const origin = "http://localhost:5173";
    const first = sessionFrom(await signInAs(fetchApp, origin, "Ben Two"));
    const second = sessionFrom(await signInAs(fetchApp, origin, "ben two"));
    const a = await meFor(fetchApp, origin, first?.value ?? "");
    const b = await meFor(fetchApp, origin, second?.value ?? "");
    expect(a.id).toBe(b.id);
    expect(b.displayName).toBe("ben two");
  });

  it("makes a test player an admin only when their email is in ADMIN_EMAILS", async () => {
    const fetchApp = makeApp("true", "chi@dev.playden.invalid");
    const session = sessionFrom(await signInAs(fetchApp, "http://localhost:5173", "Chi"));
    const me = await meFor(fetchApp, "http://localhost:5173", session?.value ?? "");
    expect(me.isAdmin).toBe(true);
  });

  it.each([
    ["", 400],
    ["A", 400],
    ["A name that is far too long", 400],
    ["!!", 400],
    [42, 400],
  ])("rejects the name %j", async (name, status) => {
    const response = await signInAs(makeApp("true"), "http://localhost:5173", name);
    expect(response.status).toBe(status);
    expect(sessionFrom(response)).toBeUndefined();
  });

  it("drops Secure from the session cookie only over http on a network address", async () => {
    const fetchApp = makeApp("true");
    const lan = sessionFrom(await signInAs(fetchApp, "http://192.168.1.5:5173", "Dev"));
    const loopback = sessionFrom(await signInAs(fetchApp, "http://localhost:5173", "Dev"));
    const https = sessionFrom(await signInAs(fetchApp, "https://192.168.1.5:5173", "Dev"));
    expect(lan?.header).not.toContain("Secure");
    expect(loopback?.header).not.toContain("Secure");
    expect(https?.header).toContain("Secure");
  });

  it("logout clears the cookie without Secure on a network address", async () => {
    const fetchApp = makeApp("true");
    const origin = "http://192.168.1.5:5173";
    const session = sessionFrom(await signInAs(fetchApp, origin, "Esha"));
    const cookie = `pd_session=${session?.value}`;
    const logout = await fetchApp(`${origin}/auth/logout`, { method: "POST", headers: { cookie } });
    const cleared = sessionFrom(logout);
    expect(cleared?.header).toContain("Max-Age=0");
    expect(cleared?.header).not.toContain("Secure");
    expect((await fetchApp(`${origin}/api/me`, { headers: { cookie } })).status).toBe(401);
  });

  it("logout keeps Secure in production", async () => {
    const response = await makeApp(undefined)("https://playden.example.workers.dev/auth/logout", {
      method: "POST",
    });
    expect(sessionFrom(response)?.header).toContain("Secure");
  });
});

describe("isLocalHost", () => {
  it.each([
    "localhost",
    "127.0.0.1",
    "[::1]",
    "10.0.0.7",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.5",
  ])("accepts %s", (host) => expect(isLocalHost(host)).toBe(true));

  it.each([
    "8.8.8.8",
    "172.15.0.1",
    "172.32.0.1",
    "192.169.1.1",
    "10.0.0",
    "1.2.3.4.5",
    "example.com",
    "192.168.1.500",
  ])("refuses %s", (host) => expect(isLocalHost(host)).toBe(false));
});
