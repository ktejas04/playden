import { profileSchema } from "@playden/protocol";
import type { Route } from "../app";
import { askAgainAt, getCurrentUser, requireUser, toMe } from "../auth/session";
import { getUser, setProfile, setStatus } from "../db/users";
import { errorJson, json, readJson } from "../http";

export const meRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/me",
    handler: async (ctx) => {
      const user = await getCurrentUser(ctx);
      if (!user) return errorJson(401, "Signed out");
      return json(toMe(user, ctx.env.ADMIN_EMAILS));
    },
  },
  {
    method: "PUT",
    path: "/api/me/profile",
    handler: async (ctx) => {
      const { user, response } = await requireUser(ctx);
      if (response) return response;

      const parsed = profileSchema.safeParse(await readJson(ctx.request));
      if (!parsed.success) {
        return errorJson(400, parsed.error.issues[0]?.message ?? "Invalid profile");
      }

      await setProfile(ctx.db, user.id, parsed.data);
      const updated = await getUser(ctx.db, user.id);
      return updated ? json(toMe(updated, ctx.env.ADMIN_EMAILS)) : errorJson(404, "Not found");
    },
  },
  {
    method: "POST",
    path: "/api/me/ask-again",
    handler: async (ctx) => {
      const { user, response } = await requireUser(ctx);
      if (response) return response;

      const allowedAt = askAgainAt(user);
      if (allowedAt === null) return errorJson(400, "There's no declined request to repeat");
      if (ctx.now < allowedAt) {
        const seconds = Math.ceil((allowedAt - ctx.now) / 1000);
        const wait = seconds < 120 ? `${seconds} seconds` : `${Math.ceil(seconds / 60)} minutes`;
        return errorJson(429, `You can ask again in ${wait}`);
      }

      await setStatus(ctx.db, user.id, "pending", ctx.now);
      const updated = await getUser(ctx.db, user.id);
      return updated ? json(toMe(updated, ctx.env.ADMIN_EMAILS)) : errorJson(404, "Not found");
    },
  },
];
