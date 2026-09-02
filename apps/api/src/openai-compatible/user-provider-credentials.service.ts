import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  getProviderRoute,
  isProviderRouteId,
  type ProviderRouteId,
} from "./provider-route-registry";

@Injectable()
export class UserProviderCredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  assertRoute(routeId: string): ProviderRouteId {
    if (!isProviderRouteId(routeId)) {
      throw new BadRequestException("Unsupported provider route.");
    }
    return routeId;
  }

  async getSecretForExecution(userId: string, routeId: string) {
    const id = this.assertRoute(routeId);
    const rows = await this.prisma.$queryRaw<Array<{ apiKey: string | null }>>(
      Prisma.sql`
        SELECT "api_key" AS "apiKey"
        FROM "user_provider_credentials"
        WHERE "user_id" = ${userId} AND "provider_route_id" = ${id}
        LIMIT 1
      `,
    );
    return rows[0]?.apiKey?.trim() || undefined;
  }

  async getStatus(userId: string, routeId: ProviderRouteId) {
    const secret = await this.getSecretForExecution(userId, routeId);
    return {
      providerRouteId: routeId,
      configured: Boolean(secret),
      ...(secret ? { maskedApiKey: this.maskSecret(secret) } : {}),
    };
  }

  async setSecret(userId: string, routeId: string, apiKey: string) {
    const id = this.assertRoute(routeId);
    const normalized = apiKey.trim();
    if (!normalized) {
      throw new BadRequestException("provider API key cannot be empty.");
    }
    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "user_provider_credentials"
          ("user_id", "provider_route_id", "api_key", "created_at", "updated_at")
        VALUES (${userId}, ${id}, ${normalized}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT ("user_id", "provider_route_id") DO UPDATE SET
          "api_key" = EXCLUDED."api_key",
          "updated_at" = CURRENT_TIMESTAMP
      `,
    );
    return this.getStatus(userId, id);
  }

  async clearSecret(userId: string, routeId: string) {
    const id = this.assertRoute(routeId);
    await this.prisma.$executeRaw(
      Prisma.sql`
        DELETE FROM "user_provider_credentials"
        WHERE "user_id" = ${userId} AND "provider_route_id" = ${id}
      `,
    );
    return this.getStatus(userId, id);
  }

  private maskSecret(value: string) {
    if (value.length <= 8) return "****";
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }
}
