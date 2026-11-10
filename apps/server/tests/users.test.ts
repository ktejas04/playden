import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "../src/db/client";
import { createSession, getSessionUser } from "../src/db/sessions";
import { getUser, listUsers, setProfile, setStatus, upsertGoogleUser } from "../src/db/users";

const NOW = 1_700_000_000_000;
const db = getDb(env.DB);

describe("users", () => {
  it("creates a new Google user as pending", async () => {
    const user = await upsertGoogleUser(db, {
      googleSub: "sub-new",
      email: "new@example.com",
      isAdmin: false,
      now: NOW,
    });
    expect(user).toMatchObject({
      googleSub: "sub-new",
      email: "new@example.com",
      status: "pending",
      displayName: null,
      createdAt: NOW,
      approvedAt: null,
    });
  });

  it("creates an admin as approved", async () => {
    const user = await upsertGoogleUser(db, {
      googleSub: "sub-admin",
      email: "admin@example.com",
      isAdmin: true,
      now: NOW,
    });
    expect(user.status).toBe("approved");
    expect(user.approvedAt).toBe(NOW);
  });

  it("keeps status and profile when the user signs in again", async () => {
    const first = await upsertGoogleUser(db, {
      googleSub: "sub-again",
      email: "again@example.com",
      isAdmin: false,
      now: NOW,
    });
    await setProfile(db, first.id, { displayName: "Asha", invitedBy: "Ravi" });
    await setStatus(db, first.id, "approved", NOW + 1);

    const second = await upsertGoogleUser(db, {
      googleSub: "sub-again",
      email: "again@example.com",
      isAdmin: false,
      now: NOW + 2,
    });
    expect(second).toMatchObject({
      id: first.id,
      status: "approved",
      displayName: "Asha",
      invitedBy: "Ravi",
      createdAt: NOW,
      approvedAt: NOW + 1,
    });
  });

  it("approves and bans; banning ends the user's sessions", async () => {
    const user = await upsertGoogleUser(db, {
      googleSub: "sub-ban",
      email: "ban@example.com",
      isAdmin: false,
      now: NOW,
    });
    await setStatus(db, user.id, "approved", NOW);
    expect((await getUser(db, user.id))?.status).toBe("approved");

    const { token } = await createSession(db, user.id, NOW);
    await setStatus(db, user.id, "banned", NOW);
    expect((await getUser(db, user.id))?.status).toBe("banned");
    expect(await getSessionUser(db, token, NOW)).toBeNull();
  });

  it("lists users by status, newest first", async () => {
    const older = await upsertGoogleUser(db, {
      googleSub: "sub-list-1",
      email: "l1@example.com",
      isAdmin: false,
      now: NOW + 100,
    });
    const newer = await upsertGoogleUser(db, {
      googleSub: "sub-list-2",
      email: "l2@example.com",
      isAdmin: false,
      now: NOW + 200,
    });
    const pending = await listUsers(db, "pending");
    const ids = pending.map((u) => u.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    expect(pending.every((u) => u.status === "pending")).toBe(true);
  });

  it("returns null for an unknown user", async () => {
    expect(await getUser(db, "nope")).toBeNull();
  });
});
