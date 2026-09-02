import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { TaskQueueService } from "../tasks/task-queue.service";
import {
  checkDatabaseReadiness,
  checkObjectStorageReadiness,
  checkQueueReadiness,
  createReadinessEnvironmentFromRecord,
  createReadinessReport,
} from "./readiness-checks";

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly taskQueue: TaskQueueService,
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
      STORAGE_MODE: this.config.get<string>("storage.mode"),
    });

    const checks = [
      await checkDatabaseReadiness(this.prisma),
      checkQueueReadiness(this.taskQueue.getStats()),
      checkObjectStorageReadiness(environment),
    ];

    return createReadinessReport("@yunwu/api", checks);
  }
}
