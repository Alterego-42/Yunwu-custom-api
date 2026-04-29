import type { UserRole as PrismaUserRole } from "@prisma/client";

export type UserRole = PrismaUserRole;

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}
