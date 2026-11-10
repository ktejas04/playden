import type { Me } from "@playden/protocol";
import type { RequestContext } from "../app";
import { ASK_AGAIN_AFTER_MS } from "../config";
import type { User } from "../db/schema";
import { getSessionUser } from "../db/sessions";
import { errorJson } from "../http";
import { isAdminEmail } from "./admins";
import { parseCookies } from "./cookies";

export const SESSION_COOKIE = "pd_session";

export function sessionToken(request: Request): string | undefined {
  return parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE) || undefined;
}

export async function getCurrentUser(ctx: RequestContext): Promise<User | null> {
  const token = sessionToken(ctx.request);
  return token ? getSessionUser(ctx.db, token, ctx.now) : null;
}

export function toMe(user: User, adminEmails: string | undefined): Me {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    invitedBy: user.invitedBy,
    status: user.status,
    isAdmin: isAdminEmail(user.email, adminEmails),
    askAgainAt: askAgainAt(user),
  };
}

export function askAgainAt(user: User): number | null {
  return user.status === "declined" && user.declinedAt !== null
    ? user.declinedAt + ASK_AGAIN_AFTER_MS
    : null;
}

type Check = { ok: true } | { ok: false; status: number; reason: string };

export function checkApproved(user: User, adminEmails: string | undefined): Check {
  if (isAdminEmail(user.email, adminEmails)) return { ok: true };
  if (user.status === "approved") return { ok: true };
  if (user.status === "banned")
    return { ok: false, status: 403, reason: "Your access was removed" };
  if (user.status === "declined")
    return { ok: false, status: 403, reason: "Your request wasn't approved" };
  return { ok: false, status: 403, reason: "Waiting for an admin to approve you" };
}

export type Guarded = { user: User; response?: never } | { user?: never; response: Response };

export async function requireUser(ctx: RequestContext): Promise<Guarded> {
  const user = await getCurrentUser(ctx);
  if (!user) return { response: errorJson(401, "Signed out") };
  if (user.status === "banned" && !isAdminEmail(user.email, ctx.env.ADMIN_EMAILS)) {
    return { response: errorJson(403, "Your access was removed") };
  }
  return { user };
}

export async function requireApproved(ctx: RequestContext): Promise<Guarded> {
  const guarded = await requireUser(ctx);
  if (!guarded.user) return guarded;
  const check = checkApproved(guarded.user, ctx.env.ADMIN_EMAILS);
  return check.ok ? guarded : { response: errorJson(check.status, check.reason) };
}
