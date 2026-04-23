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
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });

    await Promise.all(
      pendingTasks.map((task) =>
        this.taskQueue.enqueueTask(task.id, "worker-startup"),
      ),
    );

    if (pendingTasks.length > 0) {
      this.logger.log(
        `Requeued ${pendingTasks.length} pending task(s) for worker startup.`,
      );
    }
  }
}
