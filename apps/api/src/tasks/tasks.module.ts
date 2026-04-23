import { Global, Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { TaskEventsService } from "./task-events.service";
import { TaskQueueService } from "./task-queue.service";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [TaskEventsService, TaskQueueService],
  exports: [TaskEventsService, TaskQueueService],
})
export class TasksModule {}
