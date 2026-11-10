import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { checkApproved } from "../src/auth/session";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db/client";
import { type User, users } from "../src/db/schema";
import { createSession } from "../src/db/sessions";
import { upsertGoogleUser } from "../src/db/users";

const NOW = 1_700_000_000_000;
const db = getDb(env.DB);
const app = createApp({
  google: () => {
    throw new Error("Google is not used in these tests");
  },
  now: () => NOW,
});
const testEnv = { ...env, ADMIN_EMAILS: "admin@example.com" };

async function sessionFor(sub: string, email = `${sub}@example.com`) {
  const user = await upsertGoogleUser(db, {
    googleSub: sub,
    email,
    isAdmin: email === "admin@example.com",
    now: NOW,
  });
  const { token } = await createSession(db, user.id, NOW);
  return { user, cookie: `pd_session=${token}` };
}

function putProfile(cookie: string, body: unknown) {
  return app.fetch(
    new Request("https://playden.test/api/me/profile", {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    testEnv,
  );
}

function user(status: User["status"], email = "x@example.com"): User {
  return {
    id: "u",
    googleSub: "s",
    email,
    displayName: "X",
    invitedBy: "Y",
    status,
    createdAt: NOW,
    approvedAt: null,
  };
}

describe("PUT /api/me/profile", () => {
  it("saves the display name and who invited them", async () => {
    const { cookie } = await sessionFor("p1");
    const response = await putProfile(cookie, { displayName: " Asha ", invitedBy: "Ravi" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ displayName: "Asha", invitedBy: "Ravi" });
  });

  it("rejects invalid input with a reason", async () => {
    const { cookie } = await sessionFor("p2");
    const response = await putProfile(cookie, { displayName: "A", invitedBy: "Ravi" });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Name needs at least 2 characters" });
  });

  it("rejects a body that is not JSON", async () => {
    const { cookie } = await sessionFor("p3");
    const response = await app.fetch(
      new Request("https://playden.test/api/me/profile", {
        method: "PUT",
        headers: { cookie },
        body: "nope",
      }),
      testEnv,
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 when signed out", async () => {
    const response = await putProfile("", { displayName: "Asha", invitedBy: "Ravi" });
    expect(response.status).toBe(401);
  });

  it("returns 403 for a banned user who still has a session", async () => {
    const { user: banned, cookie } = await sessionFor("p4");
    await db.update(users).set({ status: "banned" }).where(eq(users.id, banned.id));
    const response = await putProfile(cookie, { displayName: "Asha", invitedBy: "Ravi" });
    expect(response.status).toBe(403);
  });
});

describe("checkApproved", () => {
  it("blocks pending and banned users", () => {
    expect(checkApproved(user("pending"), "")).toEqual({
      ok: false,
      status: 403,
      reason: "Waiting for an admin to approve you",
    });
    expect(checkApproved(user("banned"), "")).toEqual({
      ok: false,
      status: 403,
      reason: "Your access was removed",
    });
  });

  it("lets approved users and admins through", () => {
    expect(checkApproved(user("approved"), "")).toEqual({ ok: true });
    expect(checkApproved(user("pending", "admin@example.com"), "admin@example.com")).toEqual({
      ok: true,
    });
  });
});
