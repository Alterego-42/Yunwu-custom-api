import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get("health")
  check() {
    return this.healthService.getLiveness();
  }

  @Get("readiness")
  async readiness() {
    const readiness = await this.healthService.getReadiness();
    if (readiness.status === "error") {
      throw new HttpException(readiness, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return readiness;
  }
}
