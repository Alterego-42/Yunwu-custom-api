import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
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
  email: string;
  role: UserRole;
  exp: number;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
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

  async login(email: string, password: string): Promise<AuthenticatedUser> {
    const account = this.getBuiltInAccounts().find(
      (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!account || !this.secureEquals(account.password, password)) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.upsertBuiltInUser(account);
  }

  async authenticateRequest(
    request: RequestLike,
  ): Promise<AuthenticatedUser | null> {
    const token = this.readSessionToken(request);
    if (!token) {
      return null;
    }

    const payload = this.verifySessionToken(token);
    if (!payload || payload.exp <= Date.now()) {
      return null;
    }

    const account = this.getBuiltInAccounts().find(
      (item) =>
        item.email.toLowerCase() === payload.email.toLowerCase() &&
        item.role === payload.role,
    );
    if (!account) {
      return null;
    }

    return this.upsertBuiltInUser(account);
  }

  createSessionToken(user: AuthenticatedUser): string {
    const payload: SessionPayload = {
      email: user.email,
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
      this.getBuiltInAccounts().map((account) => this.upsertBuiltInUser(account)),
    );
  }

  private async upsertBuiltInUser(
    account: BuiltInAccount,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.upsert({
      where: { email: account.email },
      update: {
        displayName: account.displayName,
        metadata: { role: account.role },
      },
      create: {
        email: account.email,
        displayName: account.displayName,
        metadata: { role: account.role },
      },
    });

    return {
      id: user.id,
      email: user.email ?? account.email,
      displayName: user.displayName ?? account.displayName,
      role: account.role,
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
        typeof payload.email !== "string" ||
        (payload.role !== "admin" && payload.role !== "demo") ||
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
        password: this.config.get<string>(
          "auth.admin.password",
          "admin123456",
        ),
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

  private secureEquals(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
