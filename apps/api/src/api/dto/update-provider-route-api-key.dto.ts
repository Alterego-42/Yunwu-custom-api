import { IsString, MinLength } from "class-validator";

export class UpdateProviderRouteApiKeyDto {
  @IsString()
  @MinLength(1)
  apiKey!: string;
}
