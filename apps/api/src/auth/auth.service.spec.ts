import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import * as argon2 from "argon2";
import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { UserRole } from "@prisma/client";
import { AuthService } from "./auth.service";

type StoredUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  passwordHash: string | null;
  passwordUpdatedAt: Date | null;
};

function createConfigService(values: Record<string, unknown> = {}) {
  return {
    get<T>(key: string, defaultValue?: T): T {
      return (values[key] as T | undefined) ?? (defaultValue as T);
    },
  } as ConfigService;
}

function createPrismaStub(seedUsers: StoredUser[] = []) {
  const users = [...seedUsers];
  let nextId = users.length + 1;

  return {
    users,
    prisma: {
      user: {
        async findFirst(args: {
          where: { email: { equals: string; mode: "insensitive" } };
        }) {
          const target = args.where.email.equals.toLowerCase();
          return (
            users.find((user) => user.email?.toLowerCase() === target) ?? null
          );
        },
        async findUnique(args: { where: { id: string } }) {
          return users.find((user) => user.id === args.where.id) ?? null;
        },
        async create(args: {
          data: Omit<StoredUser, "id"> & Partial<Pick<StoredUser, "id">>;
        }) {
          const user: StoredUser = {
            id: args.data.id ?? `user_${nextId++}`,
            email: args.data.email ?? null,
            displayName: args.data.displayName ?? null,
            role: args.data.role,
            passwordHash: args.data.passwordHash ?? null,
            passwordUpdatedAt: args.data.passwordUpdatedAt ?? null,
          };
          users.push(user);
          return user;
        },
        async update(args: {
          where: { id: string };
          data: Partial<StoredUser>;
        }) {
          const index = users.findIndex((user) => user.id === args.where.id);
          assert.notStrictEqual(index, -1);
          users[index] = {
            ...users[index],
            ...args.data,
          };
          return users[index];
        },
      },
    },
  };
}

describe("AuthService", () => {
  it("registers a member user with a hashed password", async () => {
    const prismaStub = createPrismaStub();
    const service = new AuthService(
      createConfigService(),
      prismaStub.prisma as never,
    );

    const user = await service.register(
      "  NewUser@Example.com ",
      "secret123",
      "  New User  ",
    );

    assert.equal(user.email, "newuser@example.com");
    assert.equal(user.displayName, "New User");
    assert.equal(user.role, "member");
    assert.equal(prismaStub.users.length, 1);
    assert.ok(prismaStub.users[0].passwordHash);
    assert.equal(
      await argon2.verify(prismaStub.users[0].passwordHash ?? "", "secret123"),
      true,
    );
  });

  it("rejects duplicate registrations case-insensitively", async () => {
    const passwordHash = await argon2.hash("secret123");
    const prismaStub = createPrismaStub([
      {
        id: "user_existing",
        email: "existing@example.com",
        displayName: "Existing",
        role: "member",
        passwordHash,
        passwordUpdatedAt: new Date(),
      },
    ]);
    const service = new AuthService(
      createConfigService(),
      prismaStub.prisma as never,
    );

    await assert.rejects(
      () => service.register("Existing@Example.com", "secret123"),
      ConflictException,
    );
  });

  it("rejects incorrect passwords during login", async () => {
    const passwordHash = await argon2.hash("secret123");
    const prismaStub = createPrismaStub([
      {
        id: "user_member",
        email: "member@example.com",
        displayName: "Member",
        role: "member",
        passwordHash,
        passwordUpdatedAt: new Date(),
      },
    ]);
    const service = new AuthService(
      createConfigService(),
      prismaStub.prisma as never,
    );

    await assert.rejects(
      () => service.login("member@example.com", "wrong-password"),
      UnauthorizedException,
    );
  });

  it("seeds admin and demo built-ins with hashed passwords", async () => {
    const prismaStub = createPrismaStub();
    const service = new AuthService(
      createConfigService({
        "auth.admin.email": "admin@yunwu.local",
        "auth.admin.password": "admin123456",
        "auth.admin.displayName": "Administrator",
        "auth.demo.email": "demo@yunwu.local",
        "auth.demo.password": "demo123456",
        "auth.demo.displayName": "Demo User",
      }),
      prismaStub.prisma as never,
    );

    await service.onModuleInit();

    const admin = prismaStub.users.find((user) => user.role === "admin");
    const demo = prismaStub.users.find((user) => user.role === "demo");
    assert.ok(admin);
    assert.ok(demo);
    assert.equal(
      await argon2.verify(admin.passwordHash ?? "", "admin123456"),
      true,
    );
    assert.equal(
      await argon2.verify(demo.passwordHash ?? "", "demo123456"),
      true,
    );
  });

  it("marks legacy email-based cookies for clearing", async () => {
    const secret = "test-session-secret";
    const prismaStub = createPrismaStub();
    const service = new AuthService(
      createConfigService({
        "auth.sessionSecret": secret,
      }),
      prismaStub.prisma as never,
    );

    const legacyPayload = Buffer.from(
      JSON.stringify({
        email: "legacy@example.com",
        role: "member",
        exp: Date.now() + 60_000,
      }),
    ).toString("base64url");
    const legacySignature = createHmac("sha256", secret)
      .update(legacyPayload)
      .digest("base64url");

    const session = await service.resolveSession({
      headers: {
        cookie: `yunwu_session=${legacyPayload}.${legacySignature}`,
      },
    });

    assert.equal(session.user, null);
    assert.equal(session.shouldClearCookie, true);
  });
});
