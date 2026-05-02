import { IsString } from "class-validator";

export class UpdateProviderConfigDto {
  @IsString()
  baseUrl!: string;
}
