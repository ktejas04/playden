import { desc, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import { type User, type UserStatus, sessions, users } from "./schema";

interface GoogleSignIn {
  googleSub: string;
  email: string;
  isAdmin: boolean;
  now: number;
}

// Admins are (re-)approved on every sign-in; everyone else keeps their stored status.
export async function upsertGoogleUser(db: Db, signIn: GoogleSignIn): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      googleSub: signIn.googleSub,
      email: signIn.email,
      status: signIn.isAdmin ? "approved" : "pending",
      createdAt: signIn.now,
      approvedAt: signIn.isAdmin ? signIn.now : null,
    })
    .onConflictDoUpdate({
      target: users.googleSub,
      set: signIn.isAdmin
        ? {
            email: signIn.email,
            status: "approved",
            approvedAt: sql`COALESCE(${users.approvedAt}, ${signIn.now})`,
          }
        : { email: signIn.email },
    })
    .returning();
  if (!user) throw new Error("User upsert returned no row");
  return user;
}

interface DevSignIn {
  slug: string;
  email: string;
  displayName: string;
  now: number;
}

/** A local test player (D48): approved at once, and reused when the same name signs in again. */
export async function upsertDevUser(db: Db, signIn: DevSignIn): Promise<User> {
  const [user] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      googleSub: `dev:${signIn.slug}`,
      email: signIn.email,
      displayName: signIn.displayName,
      invitedBy: "test",
      status: "approved",
      createdAt: signIn.now,
      approvedAt: signIn.now,
    })
    .onConflictDoUpdate({
      target: users.googleSub,
      set: { displayName: signIn.displayName },
    })
    .returning();
  if (!user) throw new Error("Dev user upsert returned no row");
  return user;
}

export async function getUser(db: Db, id: string): Promise<User | null> {
  return (await db.query.users.findFirst({ where: eq(users.id, id) })) ?? null;
}

export async function setProfile(
  db: Db,
  id: string,
  profile: { displayName: string; invitedBy: string },
): Promise<void> {
  await db.update(users).set(profile).where(eq(users.id, id));
}

export async function setStatus(
  db: Db,
  id: string,
  status: UserStatus,
  now: number,
): Promise<void> {
  const changes =
    status === "approved"
      ? { status, approvedAt: sql`COALESCE(${users.approvedAt}, ${now})` }
      : status === "declined"
        ? { status, declinedAt: now }
        : { status };
  const update = db.update(users).set(changes).where(eq(users.id, id));
  if (status === "banned") {
    await db.batch([update, db.delete(sessions).where(eq(sessions.userId, id))]);
  } else {
    await update;
  }
}

export async function listUsers(db: Db, status?: UserStatus): Promise<User[]> {
  return db
    .select()
    .from(users)
    .where(status ? eq(users.status, status) : undefined)
    .orderBy(desc(users.createdAt));
}
