import type { Env } from "./env";
import { errorJson, json } from "./http";

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true });
    }

    return errorJson(404, "Not found");
  },
} satisfies ExportedHandler<Env>;
