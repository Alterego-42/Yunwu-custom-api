import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ForbiddenException,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_PUBLIC_KEY, AUTH_ROLES_KEY } from "./auth.constants";
import { AuthGuard } from "./auth.guard";
import type { AuthenticatedUser, UserRole } from "./auth.types";

function createContext(path = "/api/admin") {
  const request: {
    path: string;
    headers: Record<string, string>;
    user?: AuthenticatedUser;
  } = {
    path,
    headers: {},
  };
  const response = {
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };

  const context = {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => undefined,
    }),
    getClass: () => class TestController {},
    getHandler: () => function testHandler() {},
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToRpc: () => {
      throw new Error("Not implemented");
    },
    switchToWs: () => {
      throw new Error("Not implemented");
    },
  } as unknown as ExecutionContext;

  return { context, request, response };
}

function createReflector({
  isPublic = false,
  roles = [],
}: {
  isPublic?: boolean;
  roles?: UserRole[];
}) {
  return {
    getAllAndOverride<T>(metadataKey: string) {
      if (metadataKey === AUTH_PUBLIC_KEY) {
        return isPublic as T;
      }
      if (metadataKey === AUTH_ROLES_KEY) {
        return roles as T;
      }
      return undefined;
    },
  } as unknown as Reflector;
}

function createAuthService(session: {
  user: AuthenticatedUser | null;
  shouldClearCookie: boolean;
}) {
  return {
    async resolveSession() {
      return session;
    },
    createExpiredSessionCookie() {
      return "yunwu_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax";
    },
  } as never;
}

describe("AuthGuard", () => {
  it("allows admin and blocks demo/member on admin routes", async () => {
    const roles: UserRole[] = ["admin"];
    const adminGuard = new AuthGuard(
      createReflector({ roles }),
      createAuthService({
        user: {
          id: "user_admin",
          email: "admin@example.com",
          displayName: "Admin",
          role: "admin",
        },
        shouldClearCookie: false,
      }),
    );
    const demoGuard = new AuthGuard(
      createReflector({ roles }),
      createAuthService({
        user: {
          id: "user_demo",
          email: "demo@example.com",
          displayName: "Demo",
          role: "demo",
        },
        shouldClearCookie: false,
      }),
    );
    const memberGuard = new AuthGuard(
      createReflector({ roles }),
      createAuthService({
        user: {
          id: "user_member",
          email: "member@example.com",
          displayName: "Member",
          role: "member",
        },
        shouldClearCookie: false,
      }),
    );

    const adminContext = createContext();
    const demoContext = createContext();
    const memberContext = createContext();

    assert.equal(await adminGuard.canActivate(adminContext.context), true);
    assert.equal(adminContext.request.user?.role, "admin");
    await assert.rejects(
      () => demoGuard.canActivate(demoContext.context),
      ForbiddenException,
    );
    await assert.rejects(
      () => memberGuard.canActivate(memberContext.context),
      ForbiddenException,
    );
  });

  it("expires stale cookies before rejecting unauthorized requests", async () => {
    const guard = new AuthGuard(
      createReflector({ roles: ["admin"] }),
      createAuthService({
        user: null,
        shouldClearCookie: true,
      }),
    );
    const { context, response } = createContext();

    await assert.rejects(
      () => guard.canActivate(context),
      UnauthorizedException,
    );
    assert.match(response.headers["Set-Cookie"] ?? "", /Max-Age=0/);
  });
});
