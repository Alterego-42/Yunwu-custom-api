import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { OpenAICompatibleService } from "./openai-compatible.service";
import { ProviderAlertsService } from "./provider-alerts.service";
import { ProviderConfigurationService } from "./provider-configuration.service";
import { ProviderOperationalStateService } from "./provider-operational-state.service";

@Module({
  imports: [PrismaModule],
  providers: [
    OpenAICompatibleService,
    ProviderConfigurationService,
    ProviderOperationalStateService,
    ProviderAlertsService,
  ],
  exports: [
    OpenAICompatibleService,
    ProviderConfigurationService,
    ProviderOperationalStateService,
    ProviderAlertsService,
  ],
})
export class OpenAICompatibleModule {}
