import { DAY_MS, SESSION_DAYS } from "../config";
import { type User, type UserRow, toUser } from "./users";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createSession(
  db: D1Database,
  userId: string,
  now: number,
): Promise<{ token: string; expiresAt: number }> {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = now + SESSION_DAYS * DAY_MS;
  await db
    .prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(await hashToken(token), userId, expiresAt)
    .run();
  return { token, expiresAt };
}

export async function getSessionUser(
  db: D1Database,
  token: string,
  now: number,
): Promise<User | null> {
  const row = await db
    .prepare(
      `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
    )
    .bind(await hashToken(token), now)
    .first<UserRow>();
  return row ? toUser(row) : null;
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db
    .prepare("DELETE FROM sessions WHERE token_hash = ?")
    .bind(await hashToken(token))
    .run();
}
