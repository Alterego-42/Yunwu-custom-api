import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import {
  checkDatabaseReadiness,
  checkObjectStorageReadiness,
  checkRedisReadiness,
  createReadinessEnvironmentFromRecord,
  createReadinessReport,
} from "./readiness-checks";

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  getLiveness() {
    return {
      status: "ok",
      service: "@yunwu/api",
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const environment = createReadinessEnvironmentFromRecord({
      REDIS_URL: this.config.get<string>("redisUrl"),
      STORAGE_MODE: this.config.get<string>("storage.mode"),
      MINIO_ENDPOINT: this.config.get<string>("minio.endpoint"),
      MINIO_PORT: this.config.get<number>("minio.port")?.toString(),
      MINIO_USE_SSL: this.config.get<boolean>("minio.useSsl")
        ? "true"
        : "false",
    });

    const checks = await Promise.all([
      checkDatabaseReadiness(this.prisma),
      checkRedisReadiness(environment.redisUrl),
      checkObjectStorageReadiness(environment),
    ]);

    return createReadinessReport("@yunwu/api", checks);
  }
}
