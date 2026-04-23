import { Injectable } from "@nestjs/common";
import {
  Prisma,
  type Task,
  type TaskEvent,
  type TaskStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface RecordTaskEventInput {
  taskId: string;
  eventType: string;
  status?: TaskStatus;
  summary: string;
  details?: Record<string, unknown>;
  title?: string;
  detail?: string;
  errorMessage?: string;
  progress?: number;
  assetIds?: string[];
  retryOfTaskId?: string;
  retryTaskId?: string;
}

export type ConversationTaskEvent = TaskEvent & {
  task: Pick<
    Task,
    "conversationId" | "status" | "progress" | "output" | "errorMessage"
  >;
};

@Injectable()
export class TaskEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordTaskEventInput): Promise<TaskEvent> {
    return this.prisma.taskEvent.create({
      data: {
        taskId: input.taskId,
        eventType: this.trim(input.eventType, 80),
        status: input.status,
        summary: this.trim(input.summary, 500),
        details: this.toDetails(input),
      },
    });
  }

  async listForTask(taskId: string): Promise<TaskEvent[]> {
    return this.prisma.taskEvent.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });
  }

  async listForConversation(
    conversationId: string,
  ): Promise<ConversationTaskEvent[]> {
    return this.prisma.taskEvent.findMany({
      where: { task: { conversationId } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: {
        task: {
          select: {
            conversationId: true,
            status: true,
            progress: true,
            output: true,
            errorMessage: true,
          },
        },
      },
    });
  }

  private toDetails(
    input: RecordTaskEventInput,
  ): Prisma.InputJsonObject | undefined {
    const details = this.compactObject({
      ...(input.details ?? {}),
      title: input.title,
      detail: input.detail,
      errorMessage: input.errorMessage,
      progress: input.progress,
      assetIds: input.assetIds,
      retryOfTaskId: input.retryOfTaskId,
      retryTaskId: input.retryTaskId,
    });

    return Object.keys(details).length > 0
      ? (details as Prisma.InputJsonObject)
      : undefined;
  }

  private compactObject(input: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    );
  }

  private trim(value: string, maxLength: number) {
    const normalized = value.trim();
    return normalized.length > maxLength
      ? `${normalized.slice(0, Math.max(0, maxLength - 3))}...`
      : normalized;
  }
}
