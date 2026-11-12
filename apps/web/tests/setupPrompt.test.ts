import { describe, expect, it } from "vitest";
import { createSetupPromptMemory } from "../src/room/setupPrompt";

function fakeStore() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("setup prompt memory", () => {
  it("remembers a dismissed session per room, and asks again for the next session", () => {
    const store = fakeStore();
    const memory = createSetupPromptMemory(() => store);
    expect(memory.dismissed("ABCD", 1)).toBe(false);
    memory.dismiss("ABCD", 1);
    expect(memory.dismissed("ABCD", 1)).toBe(true);
    expect(memory.dismissed("ABCD", 2)).toBe(false);
    expect(memory.dismissed("WXYZ", 1)).toBe(false);
  });

  it("works without storage (private mode), it just asks again", () => {
    const memory = createSetupPromptMemory(() => {
      throw new Error("blocked");
    });
    memory.dismiss("ABCD", 1);
    expect(memory.dismissed("ABCD", 1)).toBe(false);
  });
});
