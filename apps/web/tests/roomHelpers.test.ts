import { describe, expect, it } from "vitest";
import { backoffDelay } from "../src/room/backoff";
import { normalizeJoinCode } from "../src/room/joinCode";
import { socketUrl } from "../src/room/socketUrl";

describe("socketUrl", () => {
  it("uses wss on https", () => {
    expect(socketUrl({ protocol: "https:", host: "playden.example.dev" }, "ABCD")).toBe(
      "wss://playden.example.dev/api/rooms/ABCD/ws",
    );
  });

  it("uses ws on http and keeps the port", () => {
    expect(socketUrl({ protocol: "http:", host: "localhost:5173" }, "ABCD")).toBe(
      "ws://localhost:5173/api/rooms/ABCD/ws",
    );
  });
});

describe("backoffDelay", () => {
  it("doubles from 0.5 s and caps at 10 s", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(backoffDelay)).toEqual([
      500, 1000, 2000, 4000, 8000, 10000, 10000, 10000,
    ]);
  });
});

describe("normalizeJoinCode", () => {
  it("upper-cases and strips spaces", () => {
    expect(normalizeJoinCode(" ab cd ")).toBe("ABCD");
  });

  it("accepts a pasted room link", () => {
    expect(normalizeJoinCode("https://playden.example.dev/r/bcde")).toBe("BCDE");
  });

  it("rejects look-alike letters and wrong lengths", () => {
    expect(normalizeJoinCode("ABCO")).toBeNull();
    expect(normalizeJoinCode("ABC")).toBeNull();
    expect(normalizeJoinCode("")).toBeNull();
  });
});
