import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("health", () => {
  it("GET /api/health returns ok", async () => {
    const response = await SELF.fetch("https://playden.test/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("unknown /api path returns 404 JSON", async () => {
    const response = await SELF.fetch("https://playden.test/api/nope");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});
