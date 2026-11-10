import type { Me } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import { readCachedMe, writeCachedMe } from "../src/meCache";

class MemoryStorage {
  private items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
  removeItem(key: string) {
    this.items.delete(key);
  }
}

const asha: Me = {
  id: "u1",
  email: "asha@example.com",
  displayName: "Asha",
  invitedBy: "Ravi",
  status: "approved",
  isAdmin: false,
  askAgainAt: null,
};

describe("cached account", () => {
  it("is empty until something is saved", () => {
    expect(readCachedMe(new MemoryStorage())).toBeNull();
  });

  it("returns what was saved", () => {
    const storage = new MemoryStorage();
    writeCachedMe(storage, asha);
    expect(readCachedMe(storage)).toEqual(asha);
  });

  it("is cleared on sign-out", () => {
    const storage = new MemoryStorage();
    writeCachedMe(storage, asha);
    writeCachedMe(storage, null);
    expect(readCachedMe(storage)).toBeNull();
  });

  it("ignores anything that isn't a valid account", () => {
    const storage = new MemoryStorage();
    storage.setItem("playden:me", "{not json");
    expect(readCachedMe(storage)).toBeNull();
    storage.setItem("playden:me", JSON.stringify({ ...asha, status: "boss" }));
    expect(readCachedMe(storage)).toBeNull();
  });

  it("survives storage that throws, as in some private windows", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readCachedMe(broken)).toBeNull();
    expect(() => writeCachedMe(broken, asha)).not.toThrow();
  });
});
