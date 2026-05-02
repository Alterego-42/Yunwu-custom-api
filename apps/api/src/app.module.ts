import { Module } from "@nestjs/common";
import { ApiModule } from "./api/api.module";
import { ConversationEventsModule } from "./api/conversation-events.module";
import { AuthModule } from "./auth/auth.module";
import { ApiConfigModule } from "./config/config.module";
import { HealthModule } from "./health/health.module";
import { LoggingModule } from "./logging/logging.module";
import { PrismaModule } from "./prisma/prisma.module";
import { TasksModule } from "./tasks/tasks.module";

@Module({
  imports: [
    ApiConfigModule,
    LoggingModule,
    PrismaModule,
    ConversationEventsModule,
    TasksModule,
    AuthModule,
    HealthModule,
    ApiModule,
  ],
})
export class AppModule {}
