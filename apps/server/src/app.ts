import { adminRoutes } from "./api/admin";
import { meRoutes } from "./api/me";
import { roomRoutes } from "./api/rooms";
import type { GoogleAuth } from "./auth/google";
import { authRoutes } from "./auth/routes";
import { type Db, getDb } from "./db/client";
import type { Env } from "./env";
import { errorJson, json } from "./http";

export interface AppDeps {
  google: (env: Env) => GoogleAuth;
  now: () => number;
}

export interface RequestContext {
  request: Request;
  env: Env;
  url: URL;
  params: Record<string, string>;
  db: Db;
  now: number;
  deps: AppDeps;
}

export interface Route {
  method: "GET" | "POST" | "PUT";
  path: string | RegExp;
  handler: (ctx: RequestContext) => Response | Promise<Response>;
}

const healthRoutes: Route[] = [
  { method: "GET", path: "/api/health", handler: () => json({ ok: true }) },
];

const routes: Route[] = [
  ...healthRoutes,
  ...authRoutes,
  ...meRoutes,
  ...adminRoutes,
  ...roomRoutes,
];

function match(route: Route, pathname: string): Record<string, string> | null {
  if (typeof route.path === "string") return route.path === pathname ? {} : null;
  const result = route.path.exec(pathname);
  return result ? { ...result.groups } : null;
}

export function createApp(deps: AppDeps) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const url = new URL(request.url);
      for (const route of routes) {
        if (route.method !== request.method) continue;
        const params = match(route, url.pathname);
        if (!params) continue;
        try {
          return await route.handler({
            request,
            env,
            url,
            params,
            db: getDb(env.DB),
            now: deps.now(),
            deps,
          });
        } catch (error) {
          console.error(`${request.method} ${url.pathname} failed`, error);
          return errorJson(500, "Something went wrong");
        }
      }
      return errorJson(404, "Not found");
    },
  } satisfies ExportedHandler<Env>;
}
