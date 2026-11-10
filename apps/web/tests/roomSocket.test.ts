import { ROOM_CLOSE } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import { closeOutcome } from "../src/room/closeOutcome";
import {
  createEarlySocket,
  forgetCreatedHere,
  markCreatedHere,
  wasCreatedHere,
  waitForAnswer,
} from "../src/room/earlySocket";

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

  it("joins by code from the lobby, and lets the lobby look before the room takes it", () => {
    const { early, made } = setup();
    early.join("ABCD", "ws://x");
    expect(made.map((s) => s.url)).toEqual(["ws://x/api/rooms/ABCD/ws"]);
    expect(early.peek("ABCD")).toBe(made[0]);
    expect(early.peek("WXYZ")).toBeNull();
    expect(early.take("ABCD")).toBe(made[0]);
  });

  it("a new join closes an earlier socket nobody took", () => {
    const { early, made } = setup();
    early.join("ABCD", "ws://x");
    early.join("WXYZ", "ws://x");
    expect(made[0]?.closedWith).toBe(1000);
    expect(early.take("WXYZ")).toBe(made[1]);
  });
});

describe("rooms created on this device", () => {
  it("are remembered until the first view forgets them", () => {
    markCreatedHere("ABCD");
    expect(wasCreatedHere("ABCD")).toBe(true);
    expect(wasCreatedHere("WXYZ")).toBe(false);
    forgetCreatedHere("ABCD");
    expect(wasCreatedHere("ABCD")).toBe(false);
  });
});

function closeEvent(code: number): Event {
  return Object.assign(new Event("close"), { code });
}

describe("waitForAnswer", () => {
  it("is joined once the room sends anything", async () => {
    const socket = new EventTarget();
    const answer = waitForAnswer(socket, 1000);
    socket.dispatchEvent(new Event("message"));
    expect(await answer).toEqual({ kind: "joined" });
  });

  it("reports the close code when the room refuses", async () => {
    const socket = new EventTarget();
    const answer = waitForAnswer(socket, 1000);
    socket.dispatchEvent(closeEvent(ROOM_CLOSE.notFound));
    expect(await answer).toEqual({ kind: "closed", code: ROOM_CLOSE.notFound });
  });

  it("gives up waiting after the timeout", async () => {
    expect(await waitForAnswer(new EventTarget(), 5)).toEqual({ kind: "slow" });
  });
});
