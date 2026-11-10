import { profileSchema } from "@playden/protocol";
import type { Route } from "../app";
import { getCurrentUser, requireUser, toMe } from "../auth/session";
import { getUser, setProfile } from "../db/users";
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
];
