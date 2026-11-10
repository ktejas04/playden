import type { Route } from "../app";
import { getCurrentUser, toMe } from "../auth/session";
import { errorJson, json } from "../http";

export const meRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/me",
    handler: async ({ request, env, db, now }) => {
      const user = await getCurrentUser(db, request, now);
      if (!user) return errorJson(401, "Signed out");
      return json(toMe(user, env.ADMIN_EMAILS));
    },
  },
];
