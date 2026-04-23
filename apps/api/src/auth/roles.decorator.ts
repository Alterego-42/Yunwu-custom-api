import { SetMetadata } from "@nestjs/common";
import { AUTH_ROLES_KEY } from "./auth.constants";
import type { UserRole } from "./auth.types";

export const Roles = (...roles: UserRole[]) => SetMetadata(AUTH_ROLES_KEY, roles);
