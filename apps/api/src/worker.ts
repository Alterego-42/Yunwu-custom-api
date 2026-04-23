import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerAppModule } from "./worker-app.module";

async function bootstrap() {
  const logger = new Logger("WorkerBootstrap");
  const app = await NestFactory.createApplicationContext(WorkerAppModule);

  app.enableShutdownHooks();
  logger.log("Worker context started.");

  const shutdown = async (signal: NodeJS.Signals) => {
    logger.log(`Received ${signal}, closing worker context.`);
    await app.close();
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void bootstrap();
