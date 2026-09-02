import type { UserRole as SharedUserRole } from "@yunwu/shared";

export type UserRole = SharedUserRole;

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}
