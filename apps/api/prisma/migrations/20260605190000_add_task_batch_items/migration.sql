CREATE TABLE "task_batch_items" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "batch_index" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "asset_id" TEXT,
    "error_message" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "provider_summary" JSONB,
    "output" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_batch_items_task_id_batch_index_key" ON "task_batch_items"("task_id", "batch_index");
CREATE INDEX "task_batch_items_task_id_idx" ON "task_batch_items"("task_id");
CREATE INDEX "task_batch_items_status_idx" ON "task_batch_items"("status");

ALTER TABLE "task_batch_items"
ADD CONSTRAINT "task_batch_items_task_id_fkey"
FOREIGN KEY ("task_id") REFERENCES "tasks"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_batch_items"
ADD CONSTRAINT "task_batch_items_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
