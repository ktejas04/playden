export type UserStatus = "pending" | "approved" | "banned";

export interface User {
  id: string;
  googleSub: string;
  email: string;
  displayName: string | null;
  invitedBy: string | null;
  status: UserStatus;
  createdAt: number;
  approvedAt: number | null;
}

export interface UserRow {
  id: string;
  google_sub: string;
  email: string;
  display_name: string | null;
  invited_by: string | null;
  status: UserStatus;
  created_at: number;
  approved_at: number | null;
}

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    googleSub: row.google_sub,
    email: row.email,
    displayName: row.display_name,
    invitedBy: row.invited_by,
    status: row.status,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
  };
}

interface GoogleSignIn {
  googleSub: string;
  email: string;
  isAdmin: boolean;
  now: number;
}

// Admins are (re-)approved on every sign-in; everyone else keeps their stored status.
export async function upsertGoogleUser(db: D1Database, signIn: GoogleSignIn): Promise<User> {
  const status: UserStatus = signIn.isAdmin ? "approved" : "pending";
  const row = await db
    .prepare(
      `INSERT INTO users (id, google_sub, email, status, created_at, approved_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (google_sub) DO UPDATE SET
         email = excluded.email,
         status = CASE WHEN excluded.status = 'approved' THEN 'approved' ELSE users.status END,
         approved_at = COALESCE(users.approved_at, excluded.approved_at)
       RETURNING *`,
    )
    .bind(
      crypto.randomUUID(),
      signIn.googleSub,
      signIn.email,
      status,
      signIn.now,
      signIn.isAdmin ? signIn.now : null,
    )
    .first<UserRow>();
  if (!row) throw new Error("User upsert returned no row");
  return toUser(row);
}

export async function getUser(db: D1Database, id: string): Promise<User | null> {
  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  return row ? toUser(row) : null;
}

export async function setProfile(
  db: D1Database,
  id: string,
  profile: { displayName: string; invitedBy: string },
): Promise<void> {
  await db
    .prepare("UPDATE users SET display_name = ?, invited_by = ? WHERE id = ?")
    .bind(profile.displayName, profile.invitedBy, id)
    .run();
}

export async function setStatus(
  db: D1Database,
  id: string,
  status: UserStatus,
  now: number,
): Promise<void> {
  const update = db
    .prepare(
      `UPDATE users SET status = ?1,
         approved_at = CASE WHEN ?1 = 'approved' THEN COALESCE(approved_at, ?2) ELSE approved_at END
       WHERE id = ?3`,
    )
    .bind(status, now, id);
  if (status === "banned") {
    await db.batch([update, db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(id)]);
  } else {
    await update.run();
  }
}

export async function listUsers(db: D1Database, status?: UserStatus): Promise<User[]> {
  const query = status
    ? db.prepare("SELECT * FROM users WHERE status = ? ORDER BY created_at DESC").bind(status)
    : db.prepare("SELECT * FROM users ORDER BY created_at DESC");
  const { results } = await query.all<UserRow>();
  return results.map(toUser);
}
