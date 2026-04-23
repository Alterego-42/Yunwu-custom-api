import { defineConfig } from "prisma/config";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cwd, loadEnvFile } from "node:process";

[".env.local", ".env", "../../.env.local", "../../.env"].forEach((envPath) => {
  const fullPath = join(cwd(), envPath);
  if (existsSync(fullPath)) {
    loadEnvFile(fullPath);
  }
});

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
