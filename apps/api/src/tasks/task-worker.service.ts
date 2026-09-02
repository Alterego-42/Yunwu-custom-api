import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TaskExecutionService } from "./task-execution.service";
import { TaskQueueService } from "./task-queue.service";

/**
 * 将任务执行器注册到进程内队列。
 * v0.7.0 起 worker 与 API 合并为单进程，无需独立 worker 进程与 Redis。
 */
@Injectable()
export class TaskWorkerService implements OnModuleInit {
  private readonly logger = new Logger(TaskWorkerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly taskQueue: TaskQueueService,
    private readonly taskExecution: TaskExecutionService,
  ) {}

  onModuleInit() {
    if (!this.config.get<boolean>("tasks.workerEnabled", true)) {
      this.logger.log("Task worker disabled.");
      return;
    }

    this.taskQueue.setProcessor((taskId) => this.taskExecution.execute(taskId));
    const stats = this.taskQueue.getStats();
    this.logger.log(
      `In-process task worker started (concurrency=${stats.concurrency}, batchConcurrency=${stats.batchConcurrency}).`,
    );
  }
}
