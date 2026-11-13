import { describe, expect, it } from "vitest";
import { connectedIn, nextConnected } from "../rotation";

const team = ["asha", "ben", "chi", "dev"];

describe("drawer rotation (spec section 8)", () => {
  it("moves to the next player in the rotation", () => {
    expect(nextConnected(team, "asha", new Set())).toBe("ben");
  });

  it("rotation skips away and departed players and wraps around", () => {
    expect(nextConnected(team, "chi", new Set(["dev"]))).toBe("asha");
    expect(nextConnected(team, "asha", new Set(["ben", "chi"]))).toBe("dev");
  });

  it("a lone connected player draws again", () => {
    expect(nextConnected(team, "chi", new Set(["asha", "ben", "dev"]))).toBe("chi");
  });

  it("counts the connected players of a team", () => {
    expect(connectedIn(team, new Set(["ben", "dev"]))).toEqual(["asha", "chi"]);
  });
});
