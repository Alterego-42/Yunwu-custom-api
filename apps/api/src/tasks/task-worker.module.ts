import { Module } from "@nestjs/common";
import { AssetStorageService } from "../api/storage/asset-storage.service";
import { LocalAssetStorageService } from "../api/storage/local-asset-storage.service";
import { S3AssetStorageService } from "../api/storage/s3-asset-storage.service";
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
    AssetStorageService,
    LocalAssetStorageService,
    S3AssetStorageService,
  ],
})
export class TaskWorkerModule {}
