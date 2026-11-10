import { ROOM_CLOSE } from "@playden/protocol";

export type CloseOutcome = "missing" | "refused" | "retry";

/** What a room socket's close code means for the screen: stop, recheck the account, or reconnect. */
export function closeOutcome(code: number): CloseOutcome {
  if (code === ROOM_CLOSE.notFound) return "missing";
  if (code === ROOM_CLOSE.signedOut || code === ROOM_CLOSE.notAllowed) return "refused";
  return "retry";
}
