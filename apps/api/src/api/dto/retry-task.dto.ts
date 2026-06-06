import { IsInt, IsOptional, Max, Min } from "class-validator";

export class RetryTaskDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  batchRetryCount?: number;
}
