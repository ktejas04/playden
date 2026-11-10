import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { getDb } from "../src/db/client";
import { DAY_MS, SESSION_DAYS } from "../src/config";
import { createSession, deleteSession, getSessionUser, hashToken } from "../src/db/sessions";
import { upsertGoogleUser } from "../src/db/users";

const NOW = 1_700_000_000_000;
const db = getDb(env.DB);

async function makeUser(sub: string) {
  return upsertGoogleUser(db, {
    googleSub: sub,
    email: `${sub}@example.com`,
    isAdmin: false,
    now: NOW,
  });
}

describe("sessions", () => {
  it("resolves a session token to its user", async () => {
    const user = await makeUser("s1");
    const { token, expiresAt } = await createSession(db, user.id, NOW);
    expect(expiresAt).toBe(NOW + SESSION_DAYS * DAY_MS);
    expect((await getSessionUser(db, token, NOW))?.id).toBe(user.id);
  });

  it("returns null for an expired session", async () => {
    const user = await makeUser("s2");
    const { token, expiresAt } = await createSession(db, user.id, NOW);
    expect(await getSessionUser(db, token, expiresAt)).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    expect(await getSessionUser(db, "not-a-token", NOW)).toBeNull();
  });

  it("stores only the SHA-256 hash of the token", async () => {
    const user = await makeUser("s3");
    const { token } = await createSession(db, user.id, NOW);
    const rows = await env.DB.prepare("SELECT token_hash FROM sessions WHERE user_id = ?")
      .bind(user.id)
      .all<{ token_hash: string }>();
    expect(rows.results).toEqual([{ token_hash: await hashToken(token) }]);
    expect(rows.results[0]?.token_hash).not.toBe(token);
  });

  it("deleteSession signs the token out", async () => {
    const user = await makeUser("s4");
    const { token } = await createSession(db, user.id, NOW);
    await deleteSession(db, token);
    expect(await getSessionUser(db, token, NOW)).toBeNull();
  });
});
