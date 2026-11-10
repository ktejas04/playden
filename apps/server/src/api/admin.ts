import type { AdminUser } from "@playden/protocol";
import type { RequestContext, Route } from "../app";
import { isAdminEmail } from "../auth/admins";
import { type Guarded, requireUser } from "../auth/session";
import { type User, type UserStatus, userStatuses } from "../db/schema";
import { getUser, listUsers, setStatus } from "../db/users";
import { errorJson, json } from "../http";

async function requireAdmin(ctx: RequestContext): Promise<Guarded> {
  const guarded = await requireUser(ctx);
  if (guarded.user && !isAdminEmail(guarded.user.email, ctx.env.ADMIN_EMAILS)) {
    return { response: errorJson(403, "Admins only") };
  }
  return guarded;
}

function toAdminUser(user: User, adminEmails: string | undefined): AdminUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    invitedBy: user.invitedBy,
    status: user.status,
    createdAt: user.createdAt,
    isAdmin: isAdminEmail(user.email, adminEmails),
  };
}

function isStatus(value: string): value is UserStatus {
  return (userStatuses as readonly string[]).includes(value);
}

function changeStatus(status: UserStatus): Route["handler"] {
  return async (ctx) => {
    const { response } = await requireAdmin(ctx);
    if (response) return response;

    const id = ctx.params.id ?? "";
    const target = await getUser(ctx.db, id);
    if (!target) return errorJson(404, "No such user");
    if (status === "banned" && isAdminEmail(target.email, ctx.env.ADMIN_EMAILS)) {
      return errorJson(400, "Admins can't be banned");
    }

    await setStatus(ctx.db, id, status, ctx.now);
    const updated = await getUser(ctx.db, id);
    return updated
      ? json(toAdminUser(updated, ctx.env.ADMIN_EMAILS))
      : errorJson(404, "No such user");
  };
}

export const adminRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/admin/users",
    handler: async (ctx) => {
      const { response } = await requireAdmin(ctx);
      if (response) return response;

      const status = ctx.url.searchParams.get("status");
      if (status !== null && !isStatus(status)) return errorJson(400, "Unknown status");

      const users = await listUsers(ctx.db, status ?? undefined);
      return json(users.map((user) => toAdminUser(user, ctx.env.ADMIN_EMAILS)));
    },
  },
  {
    method: "POST",
    path: /^\/api\/admin\/users\/(?<id>[^/]+)\/approve$/,
    handler: changeStatus("approved"),
  },
  {
    method: "POST",
    path: /^\/api\/admin\/users\/(?<id>[^/]+)\/ban$/,
    handler: changeStatus("banned"),
  },
];
