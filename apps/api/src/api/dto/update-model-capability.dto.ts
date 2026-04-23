import { IsBoolean } from "class-validator";

export class UpdateModelCapabilityDto {
  @IsBoolean()
  enabled!: boolean;
}
