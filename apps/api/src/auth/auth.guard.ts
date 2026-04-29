import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_PUBLIC_KEY, AUTH_ROLES_KEY } from "./auth.constants";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser, UserRole } from "./auth.types";

interface RequestWithAuth {
  path?: string;
  user?: AuthenticatedUser;
  headers?: Record<string, string | string[] | undefined>;
}

interface ResponseLike {
  setHeader(name: string, value: string): void;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      AUTH_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic || !request.path?.startsWith("/api")) {
      return true;
    }

    const response = context.switchToHttp().getResponse<ResponseLike>();
    const session = await this.authService.resolveSession(request);
    if (session.shouldClearCookie) {
      response.setHeader(
        "Set-Cookie",
        this.authService.createExpiredSessionCookie(),
      );
    }

    if (!session.user) {
      throw new UnauthorizedException("Authentication required.");
    }

    const user = session.user;

    const requiredRoles =
      this.reflector.getAllAndOverride<UserRole[]>(AUTH_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];
    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      throw new ForbiddenException("Insufficient permissions.");
    }

    request.user = user;
    return true;
  }
}
