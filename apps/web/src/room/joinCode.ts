import { ROOM_CODE_LENGTH, roomCodeSchema } from "@playden/protocol";

const LINK_CODE = /\/r\/([a-z]+)/i;

export function normalizeJoinCode(input: string): string | null {
  const fromLink = LINK_CODE.exec(input)?.[1];
  const code = (fromLink ?? input).replace(/\s+/g, "").toUpperCase();
  return roomCodeSchema.safeParse(code).success ? code : null;
}

/** What the join box should show while typing or after a paste: just the code, in capitals. */
export function cleanJoinInput(raw: string): string {
  const fromLink = LINK_CODE.exec(raw)?.[1];
  return (fromLink ?? raw)
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, ROOM_CODE_LENGTH);
}
