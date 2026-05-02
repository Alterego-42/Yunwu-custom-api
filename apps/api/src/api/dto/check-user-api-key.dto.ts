import { IsOptional, IsString } from "class-validator";

export class CheckUserApiKeyDto {
  @IsOptional()
  @IsString()
  apiKey?: string;
}
