import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OpenAICompatibleService } from "./openai-compatible.service";
import { ProviderAlertsService } from "./provider-alerts.service";
import { ProviderOperationalStateService } from "./provider-operational-state.service";

@Module({
  imports: [PrismaModule],
  providers: [
    OpenAICompatibleService,
    ProviderOperationalStateService,
    ProviderAlertsService,
  ],
  exports: [
    OpenAICompatibleService,
    ProviderOperationalStateService,
    ProviderAlertsService,
  ],
})
export class OpenAICompatibleModule {}
