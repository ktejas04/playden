import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { AdminUser } from "@playden/protocol";
import { createApp } from "../src/app";
import { getDb } from "../src/db/client";
import { createSession, getSessionUser } from "../src/db/sessions";
import { getUser, upsertGoogleUser } from "../src/db/users";

const NOW = 1_700_000_000_000;
const db = getDb(env.DB);
const app = createApp({
  google: () => {
    throw new Error("Google is not used in these tests");
  },
  now: () => NOW,
});
const testEnv = { ...env, ADMIN_EMAILS: "boss@example.com" };

async function account(sub: string, email: string, createdAt = NOW) {
  const user = await upsertGoogleUser(db, {
    googleSub: sub,
    email,
    isAdmin: email === "boss@example.com",
    now: createdAt,
  });
  const { token } = await createSession(db, user.id, NOW);
  return { user, token, cookie: `pd_session=${token}` };
}

function call(path: string, cookie: string, method = "GET") {
  return app.fetch(
    new Request(`https://playden.test${path}`, { method, headers: { cookie } }),
    testEnv,
  );
}

describe("admin routes", () => {
  it("non-admins get 403 on every admin route", async () => {
    const { cookie } = await account("a-plain", "plain@example.com");
    const { user: other } = await account("a-other", "other@example.com");
    expect((await call("/api/admin/users", cookie)).status).toBe(403);
    expect((await call(`/api/admin/users/${other.id}/approve`, cookie, "POST")).status).toBe(403);
    expect((await call(`/api/admin/users/${other.id}/ban`, cookie, "POST")).status).toBe(403);
  });

  it("signed-out callers get 401", async () => {
    expect((await call("/api/admin/users", "")).status).toBe(401);
  });

  it("lists only pending users, newest first", async () => {
    const { cookie } = await account("a-boss1", "boss@example.com");
    const older = await account("a-old", "old@example.com", NOW + 10);
    const newer = await account("a-new", "new@example.com", NOW + 20);
    const response = await call("/api/admin/users?status=pending", cookie);
    expect(response.status).toBe(200);
    const list = (await response.json()) as AdminUser[];
    expect(list.every((u) => u.status === "pending")).toBe(true);
    const ids = list.map((u) => u.id);
    expect(ids.indexOf(newer.user.id)).toBeLessThan(ids.indexOf(older.user.id));
  });

  it("rejects an unknown status filter", async () => {
    const { cookie } = await account("a-boss2", "boss@example.com");
    expect((await call("/api/admin/users?status=weird", cookie)).status).toBe(400);
  });

  it("approve moves pending to approved", async () => {
    const { cookie } = await account("a-boss3", "boss@example.com");
    const { user } = await account("a-wait", "wait@example.com");
    const response = await call(`/api/admin/users/${user.id}/approve`, cookie, "POST");
    expect(response.status).toBe(200);
    expect((await getUser(db, user.id))?.status).toBe("approved");
  });

  it("ban moves a user to banned and ends their sessions", async () => {
    const { cookie } = await account("a-boss4", "boss@example.com");
    const target = await account("a-bad", "bad@example.com");
    const response = await call(`/api/admin/users/${target.user.id}/ban`, cookie, "POST");
    expect(response.status).toBe(200);
    expect((await getUser(db, target.user.id))?.status).toBe("banned");
    expect(await getSessionUser(db, target.token, NOW)).toBeNull();
  });

  it("refuses to ban an admin", async () => {
    const boss = await account("a-boss5", "boss@example.com");
    const response = await call(`/api/admin/users/${boss.user.id}/ban`, boss.cookie, "POST");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Admins can't be banned" });
  });

  it("returns 404 for an unknown user", async () => {
    const { cookie } = await account("a-boss6", "boss@example.com");
    expect((await call("/api/admin/users/nope/approve", cookie, "POST")).status).toBe(404);
  });
});
