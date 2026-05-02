import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from "class-validator";

export class UpdateUserSettingsDto {
  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(128)
  @IsString({ each: true })
  enabledModelIds?: string[];

  @IsOptional()
  @IsObject()
  ui?: Record<string, unknown>;

  @ValidateIf((input: UpdateUserSettingsDto) => input.apiKey !== null)
  @IsOptional()
  @IsString()
  apiKey?: string | null;

  @IsOptional()
  @IsBoolean()
  clearApiKey?: boolean;
}
