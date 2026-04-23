import { Module } from "@nestjs/common";
import { ConversationEventsModule } from "./api/conversation-events.module";
import { ApiConfigModule } from "./config/config.module";
import { OpenAICompatibleModule } from "./openai-compatible/openai-compatible.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TaskWorkerModule } from "./tasks/task-worker.module";
import { TasksModule } from "./tasks/tasks.module";

@Module({
  imports: [
    ApiConfigModule,
    PrismaModule,
    OpenAICompatibleModule,
    ConversationEventsModule,
    TasksModule,
    TaskWorkerModule,
  ],
})
export class WorkerAppModule {}
