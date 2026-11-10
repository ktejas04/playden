import { describe, expect, it } from "vitest";
import { newArrivals, waitingToast } from "../src/waiting";

const person = (id: string, displayName: string | null = id) => ({ id, displayName });

describe("newArrivals", () => {
  it("reports nobody on the first check, so opening the app doesn't toast", () => {
    expect(newArrivals(null, [person("a")])).toEqual([]);
  });

  it("reports only people who weren't waiting last time", () => {
    const before = new Set(["a"]);
    expect(newArrivals(before, [person("a"), person("b")])).toEqual([person("b")]);
  });

  it("reports nobody when people only left the list", () => {
    expect(newArrivals(new Set(["a", "b"]), [person("a")])).toEqual([]);
  });
});

describe("waitingToast", () => {
  it("names one person", () => {
    expect(waitingToast([person("a", "Asha")])).toBe("Asha is waiting to join");
  });

  it("says someone when they haven't picked a name yet", () => {
    expect(waitingToast([person("a", null)])).toBe("Someone new is waiting to join");
  });

  it("counts several people", () => {
    expect(waitingToast([person("a"), person("b")])).toBe("2 new people are waiting to join");
  });
});
