import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { TaskQueueService } from "./task-queue.service";

@Injectable()
export class TaskQueueRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(TaskQueueRecoveryService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly taskQueue: TaskQueueService,
  ) {}

  async onModuleInit() {
    if (!this.config.get<boolean>("tasks.workerEnabled", true)) {
      this.logger.log("Task recovery skipped because worker is disabled.");
      return;
    }

    const pendingTasks = await this.prisma.task.findMany({
      where: { status: { in: ["queued", "submitted", "running"] } },
      select: {
        id: true,
        input: true,
        batchItems: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    await Promise.all(
      pendingTasks.map((task) => {
        const input =
          task.input && typeof task.input === "object" && !Array.isArray(task.input)
            ? (task.input as Record<string, unknown>)
            : {};
        const batchCount =
          typeof input.batchCount === "number" ? input.batchCount : 1;

        return batchCount > 1 || task.batchItems.length > 0
          ? this.taskQueue.enqueueBatchTask(task.id, "worker-startup")
          : this.taskQueue.enqueueTask(task.id, "worker-startup");
      }),
    );

    if (pendingTasks.length > 0) {
      this.logger.log(
        `Requeued ${pendingTasks.length} pending task(s) for worker startup.`,
      );
    }
  }
}
