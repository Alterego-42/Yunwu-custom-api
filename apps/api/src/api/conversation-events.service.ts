import { Injectable, Logger } from "@nestjs/common";
import { Observable, fromEventPattern, interval, map, merge } from "rxjs";

export type ConversationEventType =
  | "connected"
  | "task.updated"
  | "conversation.updated"
  | "heartbeat";

export interface ConversationEventPayload {
  type: ConversationEventType;
  conversationId: string;
  taskId?: string;
  status?: string;
  updatedAt: string;
}

export interface ConversationSignalInput {
  conversationId: string;
  taskId?: string;
  status?: string;
}

interface SseMessage {
  data: ConversationEventPayload;
  event?: string;
  id?: string;
}

type ConversationEventListener = (payload: ConversationEventPayload) => void;

/**
 * 会话事件广播：API 与任务执行器运行在同一进程内，
 * 直接用内存监听器分发 SSE 事件，无需 Redis pub/sub。
 */
@Injectable()
export class ConversationEventsService {
  private readonly logger = new Logger(ConversationEventsService.name);
  private readonly listeners = new Set<ConversationEventListener>();
  private readonly heartbeatIntervalMs = 25_000;

  publishTaskUpdated(input: ConversationSignalInput) {
    const updatedAt = new Date().toISOString();
    const payload: ConversationEventPayload = {
      type: "task.updated",
      conversationId: input.conversationId,
      taskId: input.taskId,
      status: input.status,
      updatedAt,
    };
    const conversationPayload: ConversationEventPayload = {
      type: "conversation.updated",
      conversationId: input.conversationId,
      taskId: input.taskId,
      status: input.status,
      updatedAt,
    };

    this.emit(payload);
    this.emit(conversationPayload);
  }

  createStream(conversationId: string): Observable<SseMessage> {
    const connectedAt = new Date().toISOString();
    const connected = fromEventPattern<ConversationEventPayload>(
      (handler) =>
        handler({
          type: "connected",
          conversationId,
          updatedAt: connectedAt,
        }),
      () => undefined,
    );

    const updates = fromEventPattern<ConversationEventPayload>(
      (handler) => {
        const listener: ConversationEventListener = (payload) => {
          if (payload.conversationId === conversationId) {
            handler(payload);
          }
        };
        this.listeners.add(listener);
        return listener;
      },
      (_handler, listener) => {
        if (listener) {
          this.listeners.delete(listener as ConversationEventListener);
        }
      },
    );

    const heartbeat = interval(this.heartbeatIntervalMs).pipe(
      map(
        (): ConversationEventPayload => ({
          type: "heartbeat",
          conversationId,
          updatedAt: new Date().toISOString(),
        }),
      ),
    );

    return merge(connected, updates, heartbeat).pipe(
      map((payload) => ({
        id: `${payload.type}:${payload.updatedAt}`,
        event: payload.type,
        data: payload,
      })),
    );
  }

  private emit(payload: ConversationEventPayload) {
    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Conversation event listener failed: ${message}`);
      }
    });
  }
}
