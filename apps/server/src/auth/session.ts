import type { Me } from "@playden/protocol";
import type { Db } from "../db/client";
import type { User } from "../db/schema";
import { getSessionUser } from "../db/sessions";
import { isAdminEmail } from "./admins";
import { parseCookies } from "./cookies";

export const SESSION_COOKIE = "pd_session";

export function sessionToken(request: Request): string | undefined {
  return parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE) || undefined;
}

export async function getCurrentUser(db: Db, request: Request, now: number): Promise<User | null> {
  const token = sessionToken(request);
  return token ? getSessionUser(db, token, now) : null;
}

export function toMe(user: User, adminEmails: string | undefined): Me {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    invitedBy: user.invitedBy,
    status: user.status,
    isAdmin: isAdminEmail(user.email, adminEmails),
  };
}
