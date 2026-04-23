import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Worker } from "bullmq";
import IORedis from "ioredis";
import { TaskExecutionService } from "./task-execution.service";
import { TASK_QUEUE_JOB_NAME } from "./task-queue.constants";
import type { TaskQueueJobData } from "./task-queue.service";

@Injectable()
export class TaskWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TaskWorkerService.name);
  private worker?: Worker<TaskQueueJobData>;
  private connection?: IORedis;
  private readonly handleConnectionError = (error: Error) => {
    this.logger.error(`Task worker redis error: ${error.message}`);
  };

  constructor(
    private readonly config: ConfigService,
    private readonly taskExecution: TaskExecutionService,
  ) {}

  onModuleInit() {
    if (!this.config.get<boolean>("tasks.workerEnabled", true)) {
      this.logger.log("Task worker disabled.");
      return;
    }

    const redisUrl = this.config.get<string>("redisUrl");
    if (!redisUrl) {
      throw new Error("REDIS_URL is required for task worker.");
    }

    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.connection.on("error", this.handleConnectionError);
    const queueName = this.config.get<string>(
      "tasks.queueName",
      "yunwu-image-tasks",
    );
    this.worker = new Worker<TaskQueueJobData>(
      queueName,
      (job) => this.process(job),
      {
        connection: this.connection,
        concurrency: this.config.get<number>("tasks.workerConcurrency", 1),
      },
    );
    this.logger.log(`Task worker started for queue ${queueName}.`);
    this.worker.on("failed", (job, error) => {
      this.logger.error(
        `Task job ${job?.id ?? "unknown"} failed: ${error.message}`,
      );
    });
    this.worker.on("error", (error) => {
      this.logger.error(`Task worker error: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    this.connection?.off("error", this.handleConnectionError);
    this.connection?.disconnect();
  }

  private async process(job: Job<TaskQueueJobData>) {
    if (job.name !== TASK_QUEUE_JOB_NAME) {
      this.logger.warn(`Skipping unknown task job: ${job.name}`);
      return;
    }

    await this.taskExecution.execute(job.data.taskId);
  }
}
