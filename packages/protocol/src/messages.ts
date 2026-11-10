import { z } from "zod";
import { roomCodeSchema } from "./roomCode";

export const MAX_MESSAGE_LENGTH = 4096;

const userIdSchema = z.string().min(1).max(64);

export const roomPlayerSchema = z.strictObject({
  id: userIdSchema,
  name: z.string().min(1).max(40),
  connected: z.boolean(),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ping"), t: z.number() }),
]);

export const serverMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("snapshot"),
    room: z.strictObject({
      code: roomCodeSchema,
      hostId: userIdSchema,
      players: z.array(roomPlayerSchema),
    }),
  }),
  z.strictObject({ type: z.literal("pong"), t: z.number(), serverTime: z.number() }),
  z.strictObject({ type: z.literal("error"), reason: z.string() }),
]);

export type RoomPlayer = z.infer<typeof roomPlayerSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export type ParseResult<T> = { ok: true; message: T } | { ok: false; reason: string };

function parseWith<T>(schema: z.ZodType<T>, raw: string): ParseResult<T> {
  if (raw.length > MAX_MESSAGE_LENGTH) return { ok: false, reason: "Message is too long" };
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "Message is not JSON" };
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) return { ok: false, reason: "Message is not valid" };
  return { ok: true, message: parsed.data };
}

export function parseClientMessage(raw: string): ParseResult<ClientMessage> {
  return parseWith(clientMessageSchema, raw);
}

export function parseServerMessage(raw: string): ParseResult<ServerMessage> {
  return parseWith(serverMessageSchema, raw);
}
