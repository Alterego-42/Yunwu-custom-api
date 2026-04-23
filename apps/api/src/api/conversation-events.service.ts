import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import IORedis from "ioredis";
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

@Injectable()
export class ConversationEventsService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ConversationEventsService.name);
  private readonly listeners = new Set<ConversationEventListener>();
  private readonly heartbeatIntervalMs = 25_000;
  private readonly instanceId = Math.random().toString(36).slice(2);
  private readonly channelName: string;
  private readonly publisher: IORedis;
  private readonly subscriber: IORedis;
  private readonly handlePublisherError =
    this.createRedisErrorHandler("publisher");
  private readonly handleSubscriberError =
    this.createRedisErrorHandler("subscriber");

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>("redisUrl");
    if (!redisUrl) {
      throw new Error("REDIS_URL is required for conversation events.");
    }

    this.channelName = this.config.get<string>(
      "tasks.eventsChannel",
      "yunwu-image-task-events",
    );
    this.publisher = new IORedis(redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
    this.subscriber = new IORedis(redisUrl, {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
  }

  async onModuleInit() {
    this.publisher.on("error", this.handlePublisherError);
    this.subscriber.on("error", this.handleSubscriberError);
    this.subscriber.on("message", this.handleMessage);
    await this.subscriber.subscribe(this.channelName);
  }

  async onModuleDestroy() {
    this.publisher.off("error", this.handlePublisherError);
    this.subscriber.off("error", this.handleSubscriberError);
    this.subscriber.off("message", this.handleMessage);
    await this.subscriber.unsubscribe(this.channelName);
    this.publisher.disconnect();
    this.subscriber.disconnect();
  }

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

    this.publish(payload);
    this.publish(conversationPayload);
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
    this.listeners.forEach((listener) => listener(payload));
  }

  private publish(payload: ConversationEventPayload) {
    this.emit(payload);
    void this.publisher
      .publish(
        this.channelName,
        JSON.stringify({
          sourceId: this.instanceId,
          payload,
        }),
      )
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown publish error";
        this.logger.error(`Failed to publish conversation event: ${message}`);
      });
  }

  private readonly handleMessage = (_channel: string, message: string) => {
    try {
      const parsed = JSON.parse(message) as {
        sourceId?: string;
        payload?: ConversationEventPayload;
      };

      if (parsed.sourceId === this.instanceId || !parsed.payload) {
        return;
      }

      if (
        typeof parsed.payload.type !== "string" ||
        typeof parsed.payload.conversationId !== "string" ||
        typeof parsed.payload.updatedAt !== "string"
      ) {
        return;
      }

      this.emit(parsed.payload);
    } catch (error) {
      const messageText =
        error instanceof Error ? error.message : "Unknown subscriber error";
      this.logger.warn(
        `Ignored invalid conversation event payload: ${messageText}`,
      );
    }
  };

  private createRedisErrorHandler(clientName: "publisher" | "subscriber") {
    return (error: Error) => {
      this.logger.error(
        `Conversation event ${clientName} redis error: ${error.message}`,
      );
    };
  }
}
