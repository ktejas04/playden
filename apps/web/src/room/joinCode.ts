import { roomCodeSchema } from "@playden/protocol";

export function normalizeJoinCode(input: string): string | null {
  const fromLink = /\/r\/([^/?#\s]+)/i.exec(input)?.[1];
  const code = (fromLink ?? input).replace(/\s+/g, "").toUpperCase();
  return roomCodeSchema.safeParse(code).success ? code : null;
}
