export type AccountStatus = "pending" | "approved" | "banned";

export interface Me {
  id: string;
  email: string;
  displayName: string | null;
  invitedBy: string | null;
  status: AccountStatus;
  isAdmin: boolean;
}
