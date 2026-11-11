import { ROOM_CLOSE } from "@playden/protocol";

export type CloseOutcome = "missing" | "removed" | "replaced" | "refused" | "retry";

/**
 * What a room socket's close code means for the screen: stop (room gone, you were
 * removed, or another device took your seat), recheck the account, or reconnect.
 */
export function closeOutcome(code: number): CloseOutcome {
  if (code === ROOM_CLOSE.notFound) return "missing";
  if (code === ROOM_CLOSE.removed) return "removed";
  if (code === ROOM_CLOSE.replaced) return "replaced";
  if (code === ROOM_CLOSE.signedOut || code === ROOM_CLOSE.notAllowed) return "refused";
  return "retry";
}
