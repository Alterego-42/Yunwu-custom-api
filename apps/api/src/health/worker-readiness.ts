import { PrismaClient } from "@prisma/client";
import {
  checkDatabaseReadiness,
  checkObjectStorageReadiness,
  checkRedisReadiness,
  createReadinessEnvironmentFromRecord,
  createReadinessReport,
} from "./readiness-checks";

async function main() {
  if ((process.env.TASK_WORKER_ENABLED ?? "true") === "false") {
    throw new Error("TASK_WORKER_ENABLED=false, worker container is not consuming jobs.");
  }

  const prisma = new PrismaClient();
  const environment = createReadinessEnvironmentFromRecord(process.env);

  try {
    const checks = await Promise.all([
      checkDatabaseReadiness(prisma),
      checkRedisReadiness(environment.redisUrl),
      checkObjectStorageReadiness(environment),
    ]);
    const report = createReadinessReport("@yunwu/worker", checks);

    if (report.status === "error") {
      console.error(JSON.stringify(report));
      process.exit(1);
    }

    console.log(JSON.stringify(report));
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
