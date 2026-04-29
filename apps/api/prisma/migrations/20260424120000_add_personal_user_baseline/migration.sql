-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'demo', 'member');

-- CreateEnum
CREATE TYPE "TaskSourceAction" AS ENUM ('retry', 'edit', 'variant', 'fork');

-- AlterTable
ALTER TABLE "users"
ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'member',
ADD COLUMN "password_hash" TEXT,
ADD COLUMN "password_updated_at" TIMESTAMP(3);

-- Backfill user role from existing metadata when present
UPDATE "users"
SET "role" = CASE COALESCE("metadata"->>'role', '')
  WHEN 'admin' THEN 'admin'::"UserRole"
  WHEN 'demo' THEN 'demo'::"UserRole"
  WHEN 'member' THEN 'member'::"UserRole"
  ELSE 'member'::"UserRole"
END;

-- AlterTable
ALTER TABLE "tasks"
ADD COLUMN "source_task_id" TEXT,
ADD COLUMN "source_action" "TaskSourceAction";

-- CreateIndex
CREATE INDEX "tasks_source_task_id_idx" ON "tasks"("source_task_id");

-- AddForeignKey
ALTER TABLE "tasks"
ADD CONSTRAINT "tasks_source_task_id_fkey"
FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
