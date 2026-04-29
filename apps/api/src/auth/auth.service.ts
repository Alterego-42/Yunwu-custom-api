import {
  ConflictException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, type User } from "@prisma/client";
import * as argon2 from "argon2";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser, UserRole } from "./auth.types";

interface BuiltInAccount {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
}

interface SessionPayload {
  userId: string;
  role: UserRole;
  exp: number;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
}

interface SessionResolution {
  user: AuthenticatedUser | null;
  shouldClearCookie: boolean;
}

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.ensureBuiltInUsers();
  }

  async register(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<AuthenticatedUser> {
    const normalizedEmail = this.normalizeEmail(email);
    const existingUser = await this.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException("Email already registered.");
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          displayName:
            this.normalizeDisplayName(displayName) ??
            this.buildDefaultDisplayName(normalizedEmail),
          role: "member",
          passwordHash: await this.hashPassword(password),
          passwordUpdatedAt: new Date(),
        },
      });

      return this.toAuthenticatedUser(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Email already registered.");
      }

      throw error;
    }
  }

  async login(email: string, password: string): Promise<AuthenticatedUser> {
    const user = await this.findUserByEmail(email);
    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const isPasswordValid = await this.verifyPassword(
      user.passwordHash,
      password.trim(),
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.toAuthenticatedUser(user);
  }

  async authenticateRequest(
    request: RequestLike,
  ): Promise<AuthenticatedUser | null> {
    return (await this.resolveSession(request)).user;
  }

  async resolveSession(request: RequestLike): Promise<SessionResolution> {
    const token = this.readSessionToken(request);
    if (!token) {
      return {
        user: null,
        shouldClearCookie: false,
      };
    }

    const payload = this.verifySessionToken(token);
    if (!payload || payload.exp <= Date.now()) {
      return {
        user: null,
        shouldClearCookie: true,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || !user.email || user.role !== payload.role) {
      return {
        user: null,
        shouldClearCookie: true,
      };
    }

    return {
      user: this.toAuthenticatedUser(user),
      shouldClearCookie: false,
    };
  }

  createSessionToken(user: AuthenticatedUser): string {
    const payload: SessionPayload = {
      userId: user.id,
      role: user.role,
      exp: Date.now() + this.getSessionTtlMs(),
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64url",
    );
    const signature = this.sign(encodedPayload);

    return `${encodedPayload}.${signature}`;
  }

  getCookieName(): string {
    return this.config.get<string>("auth.cookieName", "yunwu_session");
  }

  createSessionCookie(token: string): string {
    const maxAgeSeconds = Math.floor(this.getSessionTtlMs() / 1000);
    const parts = [
      `${this.getCookieName()}=${token}`,
      "Path=/",
      "HttpOnly",
      `Max-Age=${maxAgeSeconds}`,
      "SameSite=Lax",
    ];

    if (this.shouldUseSecureCookies()) {
      parts.push("Secure");
    }

    return parts.join("; ");
  }

  createExpiredSessionCookie(): string {
    const parts = [
      `${this.getCookieName()}=`,
      "Path=/",
      "HttpOnly",
      "Max-Age=0",
      "SameSite=Lax",
    ];

    if (this.shouldUseSecureCookies()) {
      parts.push("Secure");
    }

    return parts.join("; ");
  }

  private async ensureBuiltInUsers() {
    await Promise.all(
      this.getBuiltInAccounts().map((account) => this.syncBuiltInUser(account)),
    );
  }

  private async syncBuiltInUser(
    account: BuiltInAccount,
  ): Promise<AuthenticatedUser> {
    const normalizedEmail = this.normalizeEmail(account.email);
    const existingUser = await this.findUserByEmail(normalizedEmail);
    const shouldRotatePassword =
      !existingUser?.passwordHash ||
      !(await this.verifyPassword(existingUser.passwordHash, account.password));

    if (!existingUser) {
      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          displayName: account.displayName,
          role: account.role,
          passwordHash: await this.hashPassword(account.password),
          passwordUpdatedAt: new Date(),
        },
      });

      return this.toAuthenticatedUser(user);
    }

    const data: Prisma.UserUpdateInput = {};
    if (existingUser.email !== normalizedEmail) {
      data.email = normalizedEmail;
    }
    if (existingUser.displayName !== account.displayName) {
      data.displayName = account.displayName;
    }
    if (existingUser.role !== account.role) {
      data.role = account.role;
    }
    if (shouldRotatePassword) {
      data.passwordHash = await this.hashPassword(account.password);
      data.passwordUpdatedAt = new Date();
    }

    if (Object.keys(data).length === 0) {
      return this.toAuthenticatedUser(existingUser);
    }

    const user = await this.prisma.user.update({
      where: { id: existingUser.id },
      data,
    });

    return this.toAuthenticatedUser(user);
  }

  private async findUserByEmail(email: string) {
    const normalizedEmail = this.normalizeEmail(email);
    return this.prisma.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
    });
  }

  private toAuthenticatedUser(
    user: Pick<User, "id" | "email" | "displayName" | "role">,
  ): AuthenticatedUser {
    const email = user.email ?? "";
    return {
      id: user.id,
      email,
      displayName:
        this.normalizeDisplayName(user.displayName) ??
        this.buildDefaultDisplayName(email),
      role: user.role,
    };
  }

  private readSessionToken(request: RequestLike): string | null {
    const cookieHeader = request.headers?.cookie;
    if (!cookieHeader) {
      return null;
    }

    const rawCookie = Array.isArray(cookieHeader)
      ? cookieHeader.join("; ")
      : cookieHeader;

    const cookies = rawCookie.split(";").map((part) => part.trim());
    const target = cookies.find((part) =>
      part.startsWith(`${this.getCookieName()}=`),
    );

    return target ? target.slice(this.getCookieName().length + 1) : null;
  }

  private verifySessionToken(token: string): SessionPayload | null {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = this.sign(encodedPayload);
    if (!this.secureEquals(expectedSignature, signature)) {
      return null;
    }

    try {
      const payload = JSON.parse(
        Buffer.from(encodedPayload, "base64url").toString("utf8"),
      ) as SessionPayload;
      if (
        typeof payload.userId !== "string" ||
        (payload.role !== "admin" &&
          payload.role !== "demo" &&
          payload.role !== "member") ||
        typeof payload.exp !== "number"
      ) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private sign(value: string) {
    return createHmac("sha256", this.getSessionSecret())
      .update(value)
      .digest("base64url");
  }

  private getSessionSecret() {
    return this.config.get<string>(
      "auth.sessionSecret",
      "yunwu-dev-session-secret-change-me",
    );
  }

  private getSessionTtlMs() {
    const ttlHours = this.config.get<number>("auth.sessionTtlHours", 168);
    return Math.max(1, ttlHours) * 60 * 60 * 1000;
  }

  private shouldUseSecureCookies() {
    if (this.config.get<string>("auth.cookieSecure") === "false") {
      return false;
    }

    return this.config.get<string>("nodeEnv") === "production";
  }

  private getBuiltInAccounts(): BuiltInAccount[] {
    return [
      {
        email: this.config.get<string>("auth.admin.email", "admin@yunwu.local"),
        password: this.config.get<string>("auth.admin.password", "admin123456"),
        displayName: this.config.get<string>(
          "auth.admin.displayName",
          "Administrator",
        ),
        role: "admin",
      },
      {
        email: this.config.get<string>("auth.demo.email", "demo@yunwu.local"),
        password: this.config.get<string>("auth.demo.password", "demo123456"),
        displayName: this.config.get<string>(
          "auth.demo.displayName",
          "Demo User",
        ),
        role: "demo",
      },
    ];
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private normalizeDisplayName(displayName?: string | null) {
    const value = displayName?.trim();
    return value ? value : null;
  }

  private buildDefaultDisplayName(email: string) {
    const localPart = email.split("@")[0]?.trim();
    return localPart || "User";
  }

  private async hashPassword(password: string) {
    return argon2.hash(password.trim());
  }

  private async verifyPassword(passwordHash: string, password: string) {
    try {
      return await argon2.verify(passwordHash, password.trim());
    } catch {
      return false;
    }
  }

  private secureEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
