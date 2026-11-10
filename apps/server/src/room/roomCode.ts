import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "@playden/protocol";

// Modulo bias over 256 values is under 2% per letter, fine for room codes.
export function generateRoomCode(randomBytes: Uint8Array): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[(randomBytes[i] ?? 0) % ROOM_CODE_ALPHABET.length];
  }
  return code;
}
