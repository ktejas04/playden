import { describe, expect, it } from "vitest";
import { isAdminEmail } from "../src/auth/admins";

describe("isAdminEmail", () => {
  it("matches ignoring case and spaces", () => {
    expect(isAdminEmail("Asha@Example.com", " asha@example.com , ravi@example.com")).toBe(true);
    expect(isAdminEmail("ravi@example.com", "asha@example.com,ravi@example.com")).toBe(true);
  });

  it("rejects emails not in the list", () => {
    expect(isAdminEmail("eve@example.com", "asha@example.com")).toBe(false);
  });

  it("treats an empty list as no admins", () => {
    expect(isAdminEmail("asha@example.com", "")).toBe(false);
    expect(isAdminEmail("", "")).toBe(false);
  });
});
