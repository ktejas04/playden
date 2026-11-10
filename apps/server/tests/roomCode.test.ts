import { ROOM_CODE_ALPHABET, roomCodeSchema } from "@playden/protocol";
import { describe, expect, it } from "vitest";
import { generateRoomCode } from "../src/room/roomCode";

describe("generateRoomCode", () => {
  it("returns 4 letters from the room-code alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode(crypto.getRandomValues(new Uint8Array(4)));
      expect(roomCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("maps bytes onto the alphabet deterministically", () => {
    const n = ROOM_CODE_ALPHABET.length;
    expect(generateRoomCode(new Uint8Array([0, 1, n, n + 2]))).toBe(
      `${ROOM_CODE_ALPHABET[0]}${ROOM_CODE_ALPHABET[1]}${ROOM_CODE_ALPHABET[0]}${ROOM_CODE_ALPHABET[2]}`,
    );
  });
});
