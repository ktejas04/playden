import { describe, expect, it, vi } from "vitest";
import { navigate, parseRoute, setNavigationGuard } from "../src/router";

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

  it("maps /privacy to the privacy page", () => {
    expect(parseRoute("/privacy")).toEqual({ name: "privacy" });
  });

  it("maps anything else to notFound", () => {
    expect(parseRoute("/nope")).toEqual({ name: "notFound" });
  });
});

describe("navigation guard", () => {
  it("lets a guard keep the page, until it navigates with force", () => {
    const pushed: string[] = [];
    const fakeWindow = {
      history: { pushState: (_: unknown, __: string, path: string) => pushed.push(path) },
      dispatchEvent: () => true,
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("Event", function FakeEvent() {});
    const asked: string[] = [];
    const remove = setNavigationGuard((path) => {
      asked.push(path);
      return false;
    });

    navigate("/");
    expect(asked).toEqual(["/"]);
    expect(pushed).toEqual([]);

    navigate("/", { force: true });
    expect(pushed).toEqual(["/"]);

    remove();
    navigate("/admin");
    expect(pushed).toEqual(["/", "/admin"]);
    vi.unstubAllGlobals();
  });
});
