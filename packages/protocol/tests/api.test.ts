import { describe, expect, it } from "vitest";
import { profileSchema } from "../src";

describe("profileSchema", () => {
  it("trims and accepts a valid profile", () => {
    expect(profileSchema.parse({ displayName: "  Asha  ", invitedBy: " Ravi " })).toEqual({
      displayName: "Asha",
      invitedBy: "Ravi",
    });
  });

  it("rejects a display name under 2 or over 20 characters", () => {
    expect(profileSchema.safeParse({ displayName: "A", invitedBy: "Ravi" }).success).toBe(false);
    expect(profileSchema.safeParse({ displayName: "  A  ", invitedBy: "Ravi" }).success).toBe(
      false,
    );
    expect(
      profileSchema.safeParse({ displayName: "A".repeat(21), invitedBy: "Ravi" }).success,
    ).toBe(false);
  });

  it("requires 'invited by', up to 40 characters", () => {
    expect(profileSchema.safeParse({ displayName: "Asha", invitedBy: "  " }).success).toBe(false);
    expect(
      profileSchema.safeParse({ displayName: "Asha", invitedBy: "R".repeat(41) }).success,
    ).toBe(false);
  });

  it("rejects extra fields", () => {
    expect(
      profileSchema.safeParse({ displayName: "Asha", invitedBy: "Ravi", status: "approved" })
        .success,
    ).toBe(false);
  });
});
