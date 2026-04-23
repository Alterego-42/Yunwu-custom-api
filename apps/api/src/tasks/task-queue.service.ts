import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";
import { TASK_QUEUE_JOB_NAME } from "./task-queue.constants";

export interface TaskQueueJobData {
  taskId: string;
}

@Injectable()
export class TaskQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskQueueService.name);
  private readonly connection: IORedis;
  private readonly queue: Queue<TaskQueueJobData>;
  private readonly queueName: string;
  private readonly handleConnectionError = (error: Error) => {
    this.logger.error(`Task queue redis error: ${error.message}`);
  };

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>("redisUrl");
    if (!redisUrl) {
      throw new Error("REDIS_URL is required for task queue.");
    }

    this.connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.connection.on("error", this.handleConnectionError);
    this.queueName = this.config.get<string>(
      "tasks.queueName",
      "yunwu-image-tasks",
    );
    this.queue = new Queue<TaskQueueJobData>(this.queueName, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 604_800 },
      },
    });
  }

  async onModuleDestroy() {
    this.connection.off("error", this.handleConnectionError);
    await this.queue.close();
    this.connection.disconnect();
  }

  async enqueueTask(taskId: string, source = "api") {
    await this.queue.add(
      TASK_QUEUE_JOB_NAME,
      { taskId },
      {
        jobId: taskId,
      },
    );
    this.logger.debug(`Queued task ${taskId} from ${source}.`);
  }
}
