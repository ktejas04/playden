import { describe, expect, it, vi } from "vitest";
import type { RecordWrite } from "../src/db/gameRecords";
import { RecordWriter } from "../src/room/RecordWriter";

/**
 * The room's writes to the permanent record (D58). When D1 refuses writes (a blip, or the
 * free tier's daily limit), the game must carry on: nothing is thrown, later writes still go
 * through, and the queue always settles so a closing room can finish closing.
 */

const write = (gameId: string): RecordWrite => ({ kind: "gameDeactivated", gameId });
const idOf = (w: RecordWrite) => (w.kind === "gameDeactivated" ? w.gameId : w.kind);

describe("RecordWriter", () => {
  it("writes in the order they were added, one at a time", async () => {
    const done: string[] = [];
    let running = 0;
    const writer = new RecordWriter(async (w) => {
      running++;
      expect(running).toBe(1);
      await new Promise((resolve) => setTimeout(resolve, 5));
      done.push(idOf(w));
      running--;
    });
    writer.add([write("a"), write("b")]);
    writer.add([write("c")]);
    await writer.settled();
    expect(done).toEqual(["a", "b", "c"]);
  });

  it("retries a write that fails once, and it goes through", async () => {
    const attempts: string[] = [];
    const writer = new RecordWriter(async (w) => {
      attempts.push(idOf(w));
      if (attempts.length === 1) throw new Error("D1 blip");
    });
    writer.add([write("a")]);
    await writer.settled();
    expect(attempts).toEqual(["a", "a"]);
  });

  it("gives up on a write that keeps failing after 3 tries, logs it, and still does the next", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const attempts: string[] = [];
    const writer = new RecordWriter(async (w) => {
      attempts.push(idOf(w));
      if (idOf(w) === "bad") throw new Error("Too many rows written today");
    });
    writer.add([write("bad"), write("good")]);
    await writer.settled();
    expect(attempts).toEqual(["bad", "bad", "bad", "good"]);
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0]?.[0]).toBe("Couldn't record gameDeactivated");
    logged.mockRestore();
  });

  it("never throws to the room, even when the write itself throws at once", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const writer = new RecordWriter(() => {
      throw new Error("Database binding missing");
    });
    expect(() => writer.add([write("a")])).not.toThrow();
    await expect(writer.settled()).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });

  it("settles at once when nothing was added", async () => {
    const writer = new RecordWriter(async () => undefined);
    await expect(writer.settled()).resolves.toBeUndefined();
  });
});
