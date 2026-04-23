import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import type { CapabilityType } from "../api.types";

const SUPPORTED_TASK_CAPABILITIES: CapabilityType[] = [
  "image.generate",
  "image.edit",
];

export class CreateTaskDto {
  @IsString()
  conversationId!: string;

  @IsIn(SUPPORTED_TASK_CAPABILITIES)
  capability!: CapabilityType;

  @IsString()
  model!: string;

  @IsString()
  @MaxLength(8000)
  prompt!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(16)
  @IsString({ each: true })
  assetIds?: string[];

  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
