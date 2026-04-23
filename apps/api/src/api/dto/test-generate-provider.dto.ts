import { IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class TestGenerateProviderDto {
  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  prompt?: string;

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
