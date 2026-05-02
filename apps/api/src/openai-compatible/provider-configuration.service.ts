import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DEFAULT_YUNWU_BASE_URL,
  isSupportedYunwuBaseUrl,
  YUNWU_BASE_URLS,
} from "./yunwu-model-registry";

export const PROVIDER_CONFIGURATION_ID = "singleton";

@Injectable()
export class ProviderConfigurationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getBaseUrl() {
    const rows = await this.prisma.$queryRaw<Array<{ baseUrl: string }>>(
      Prisma.sql`
        SELECT "base_url" AS "baseUrl"
        FROM "provider_configuration"
        WHERE "id" = ${PROVIDER_CONFIGURATION_ID}
        LIMIT 1
      `,
    );

    return rows[0]?.baseUrl ?? this.getConfiguredDefaultBaseUrl();
  }

  async updateBaseUrl(baseUrl: string) {
    const normalized = this.normalizeBaseUrl(baseUrl);
    if (!isSupportedYunwuBaseUrl(normalized)) {
      throw new BadRequestException(
        `Unsupported Yunwu base_url. Use one of: ${YUNWU_BASE_URLS.join(", ")}.`,
      );
    }

    await this.prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO "provider_configuration" ("id", "base_url", "updated_at")
        VALUES (${PROVIDER_CONFIGURATION_ID}, ${normalized}, NOW())
        ON CONFLICT ("id") DO UPDATE SET
          "base_url" = EXCLUDED."base_url",
          "updated_at" = NOW()
      `,
    );

    return { id: PROVIDER_CONFIGURATION_ID, baseUrl: normalized };
  }

  getConfiguredDefaultBaseUrl() {
    const configured = this.normalizeBaseUrl(
      this.config.get<string>("yunwu.baseUrl") ?? DEFAULT_YUNWU_BASE_URL,
    );

    return isSupportedYunwuBaseUrl(configured)
      ? configured
      : DEFAULT_YUNWU_BASE_URL;
  }

  private normalizeBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/$/, "");
  }
}
