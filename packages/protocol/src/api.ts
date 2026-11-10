import { z } from "zod";

export type AccountStatus = "pending" | "approved" | "banned";

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  invitedBy: string | null;
  status: AccountStatus;
  isAdmin: boolean;
}

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
}

export interface ApiError {
  error: string;
}
