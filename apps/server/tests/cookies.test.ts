import { describe, expect, it } from "vitest";
import { parseCookies, serializeCookie } from "../src/auth/cookies";

describe("cookies", () => {
  it("round-trips a value", () => {
    const header = serializeCookie("pd_session", "abc-123_x");
    const pair = header.split(";")[0] ?? "";
    expect(parseCookies(pair).get("pd_session")).toBe("abc-123_x");
  });

  it("sets HttpOnly, Secure, SameSite=Lax and Path=/ by default", () => {
    const header = serializeCookie("pd_session", "v", { maxAge: 60 });
    expect(header).toBe("pd_session=v; Path=/; Max-Age=60; HttpOnly; Secure; SameSite=Lax");
  });

  it("parses several cookies and ignores junk", () => {
    const cookies = parseCookies("a=1; b=two;junk; c=");
    expect(cookies.get("a")).toBe("1");
    expect(cookies.get("b")).toBe("two");
    expect(cookies.get("c")).toBe("");
    expect(cookies.has("junk")).toBe(false);
  });

  it("handles a missing header", () => {
    expect(parseCookies(null).size).toBe(0);
  });
});
