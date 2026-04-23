import { Global, Module } from "@nestjs/common";
import { ConversationEventsService } from "./conversation-events.service";

@Global()
@Module({
  providers: [ConversationEventsService],
  exports: [ConversationEventsService],
})
export class ConversationEventsModule {}
