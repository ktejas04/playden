import { describe, expect, it } from "vitest";
import { ROOM_EMPTY_CLOSE_MS, roomEmptyCloseMs } from "../src/config";

describe("roomEmptyCloseMs", () => {
  it("uses the default when no override is set", () => {
    expect(roomEmptyCloseMs(undefined)).toBe(ROOM_EMPTY_CLOSE_MS);
  });

  it("uses a positive whole-number override", () => {
    expect(roomEmptyCloseMs("20000")).toBe(20_000);
  });

  it.each(["", "abc", "0", "-5", "1.5"])("ignores the invalid override %j", (value) => {
    expect(roomEmptyCloseMs(value)).toBe(ROOM_EMPTY_CLOSE_MS);
  });
});
