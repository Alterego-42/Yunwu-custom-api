import { Module } from "@nestjs/common";
import { ConversationEventsModule } from "../api/conversation-events.module";
import { OpenAICompatibleModule } from "../openai-compatible/openai-compatible.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TasksModule } from "./tasks.module";
import { TaskExecutionService } from "./task-execution.service";
import { TaskQueueRecoveryService } from "./task-queue-recovery.service";
import { TaskWorkerService } from "./task-worker.service";

@Module({
  imports: [
    PrismaModule,
    OpenAICompatibleModule,
    ConversationEventsModule,
    TasksModule,
  ],
  providers: [
    TaskExecutionService,
    TaskQueueRecoveryService,
    TaskWorkerService,
  ],
})
export class TaskWorkerModule {}
