import { ROOM_CLOSE } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import { closeOutcome } from "../src/room/closeOutcome";
import { createEarlySocket } from "../src/room/earlySocket";

describe("closeOutcome", () => {
  it("stops on a room that doesn't exist", () => {
    expect(closeOutcome(ROOM_CLOSE.notFound)).toBe("missing");
  });

  it("stops and rechecks the account when signed out or not allowed", () => {
    expect(closeOutcome(ROOM_CLOSE.signedOut)).toBe("refused");
    expect(closeOutcome(ROOM_CLOSE.notAllowed)).toBe("refused");
  });

  it("stops for good when the host or an admin removed you", () => {
    expect(closeOutcome(ROOM_CLOSE.removed)).toBe("removed");
  });

  it("retries anything else, such as a dropped network", () => {
    expect(closeOutcome(1006)).toBe("retry");
    expect(closeOutcome(1001)).toBe("retry");
  });
});

class FakeSocket {
  closedWith: number | null = null;
  constructor(readonly url: string) {}
  close(code: number) {
    this.closedWith = code;
  }
}

function setup() {
  const made: FakeSocket[] = [];
  const early = createEarlySocket((url) => {
    const socket = new FakeSocket(url);
    made.push(socket);
    return socket;
  });
  return { early, made };
}

describe("early room socket", () => {
  it("opens only on a room page", () => {
    const { early, made } = setup();
    early.start("/", "ws://x");
    early.start("/admin", "ws://x");
    expect(made).toHaveLength(0);
    early.start("/r/abcd", "ws://x");
    expect(made.map((s) => s.url)).toEqual(["ws://x/api/rooms/ABCD/ws"]);
  });

  it("hands the socket over once, to the same room", () => {
    const { early, made } = setup();
    early.start("/r/ABCD", "ws://x");
    expect(early.take("ABCD")).toBe(made[0]);
    expect(early.take("ABCD")).toBeNull();
  });

  it("closes a socket that is asked for by another room", () => {
    const { early, made } = setup();
    early.start("/r/ABCD", "ws://x");
    expect(early.take("WXYZ")).toBeNull();
    expect(made[0]?.closedWith).toBe(1000);
  });

  it("closes a socket nobody takes", () => {
    const { early, made } = setup();
    early.start("/r/ABCD", "ws://x");
    early.abandon();
    expect(made[0]?.closedWith).toBe(1000);
    expect(early.take("ABCD")).toBeNull();
  });
});
