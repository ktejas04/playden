import { z } from "zod";

export type AccountStatus = "pending" | "approved" | "declined" | "banned";

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  invitedBy: string | null;
  status: AccountStatus;
  isAdmin: boolean;
  /** When a declined person may ask again (ms since epoch); null unless declined. */
  askAgainAt: number | null;
}

export const meSchema = z.strictObject({
  id: z.string().min(1),
  email: z.string(),
  displayName: z.string().nullable(),
  invitedBy: z.string().nullable(),
  status: z.enum(["pending", "approved", "declined", "banned"]),
  isAdmin: z.boolean(),
  askAgainAt: z.number().nullable(),
}) satisfies z.ZodType<Me>;

export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 20;
export const INVITED_BY_MAX = 40;

export const profileSchema = z.strictObject({
  displayName: z
    .string()
    .trim()
    .min(DISPLAY_NAME_MIN, `Name needs at least ${DISPLAY_NAME_MIN} characters`)
    .max(DISPLAY_NAME_MAX, `Name can be at most ${DISPLAY_NAME_MAX} characters`),
  invitedBy: z
    .string()
    .trim()
    .min(1, "Tell us who invited you")
    .max(INVITED_BY_MAX, `Keep it under ${INVITED_BY_MAX} characters`),
});

export type Profile = z.infer<typeof profileSchema>;

export interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  invitedBy: string | null;
  status: AccountStatus;
  createdAt: number;
  isAdmin: boolean;
  /** Was approved at some point; tells a banned former member from a blocked request. */
  wasMember: boolean;
  /** Waiting again after being declined before. */
  askedAgain: boolean;
}

export interface ApiError {
  error: string;
}
