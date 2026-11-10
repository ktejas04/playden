import { describe, expect, it } from "vitest";
import { parseRoute } from "../src/router";

describe("parseRoute", () => {
  it("maps / to home", () => {
    expect(parseRoute("/")).toEqual({ name: "home" });
  });

  it("maps /r/CODE to a room, upper-casing the code", () => {
    expect(parseRoute("/r/ABCD")).toEqual({ name: "room", code: "ABCD" });
    expect(parseRoute("/r/abcd")).toEqual({ name: "room", code: "ABCD" });
    expect(parseRoute("/r/ABCD/")).toEqual({ name: "room", code: "ABCD" });
  });

  it("rejects room codes with look-alike letters or the wrong length", () => {
    expect(parseRoute("/r/ABCO")).toEqual({ name: "notFound" });
    expect(parseRoute("/r/ABC")).toEqual({ name: "notFound" });
  });

  it("maps /admin to admin", () => {
    expect(parseRoute("/admin")).toEqual({ name: "admin" });
  });

  it("maps anything else to notFound", () => {
    expect(parseRoute("/nope")).toEqual({ name: "notFound" });
  });
});
