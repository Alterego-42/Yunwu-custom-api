import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { ApixoService } from "./apixo.service";
import { ImageProviderService } from "./image-provider.service";
import { OpenAICompatibleService } from "./openai-compatible.service";
import { ProviderAlertsService } from "./provider-alerts.service";
import { ProviderConfigurationService } from "./provider-configuration.service";
import { ProviderOperationalStateService } from "./provider-operational-state.service";
import { UserProviderCredentialsService } from "./user-provider-credentials.service";

@Module({
  imports: [PrismaModule],
  providers: [
    OpenAICompatibleService,
    ApixoService,
    ImageProviderService,
    ProviderConfigurationService,
    ProviderOperationalStateService,
    ProviderAlertsService,
    UserProviderCredentialsService,
  ],
  exports: [
    OpenAICompatibleService,
    ApixoService,
    ImageProviderService,
    ProviderConfigurationService,
    ProviderOperationalStateService,
    ProviderAlertsService,
    UserProviderCredentialsService,
  ],
})
export class OpenAICompatibleModule {}
