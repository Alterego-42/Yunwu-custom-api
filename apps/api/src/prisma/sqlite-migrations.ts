import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";

/**
 * 轻量 SQLite 迁移执行器：打包运行环境不携带 Prisma CLI，
 * 启动时按目录顺序应用 prisma/migrations 下未执行过的 migration.sql。
 */

const MIGRATION_TABLE = "_yunwu_migrations";

export function resolveSqliteFilePath(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return undefined;
  }

  const rawPath = databaseUrl.slice("file:".length).split("?")[0];
  return isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), rawPath);
}

export async function ensureSqliteDirectory(databaseUrl: string) {
  const filePath = resolveSqliteFilePath(databaseUrl);
  if (filePath) {
    await mkdir(dirname(filePath), { recursive: true });
  }
}

function splitSqlStatements(sql: string) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => {
      const withoutComments = statement
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim();
      return withoutComments.length > 0;
    });
}

export interface ApplyMigrationsOptions {
  databaseUrl: string;
  migrationsDir?: string;
  log?: (message: string) => void;
}

export function getDefaultMigrationsDir() {
  return (
    process.env.PRISMA_MIGRATIONS_DIR ??
    join(__dirname, "..", "..", "prisma", "migrations")
  );
}

export async function applySqliteMigrations(options: ApplyMigrationsOptions) {
  const migrationsDir = options.migrationsDir ?? getDefaultMigrationsDir();
  const log = options.log ?? (() => undefined);

  if (!existsSync(migrationsDir)) {
    log(`Migrations directory not found at ${migrationsDir}; skipping.`);
    return { applied: [] as string[] };
  }

  await ensureSqliteDirectory(options.databaseUrl);

  const prisma = new PrismaClient({
    datasources: { db: { url: options.databaseUrl } },
  });

  try {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "${MIGRATION_TABLE}" (` +
        `"name" TEXT NOT NULL PRIMARY KEY, ` +
        `"applied_at" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
    );

    const appliedRows = await prisma.$queryRawUnsafe<{ name: string }[]>(
      `SELECT "name" FROM "${MIGRATION_TABLE}"`,
    );
    const appliedNames = new Set(appliedRows.map((row) => row.name));

    const entries = (await readdir(migrationsDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    const applied: string[] = [];
    for (const name of entries) {
      if (appliedNames.has(name)) {
        continue;
      }

      const sqlPath = join(migrationsDir, name, "migration.sql");
      if (!existsSync(sqlPath)) {
        continue;
      }

      const sql = await readFile(sqlPath, "utf8");
      const statements = splitSqlStatements(sql);
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }

      await prisma.$executeRawUnsafe(
        `INSERT INTO "${MIGRATION_TABLE}" ("name") VALUES (?)`,
        name,
      );
      applied.push(name);
      log(`Applied migration ${name} (${statements.length} statements).`);
    }

    return { applied };
  } finally {
    await prisma.$disconnect();
  }
}
