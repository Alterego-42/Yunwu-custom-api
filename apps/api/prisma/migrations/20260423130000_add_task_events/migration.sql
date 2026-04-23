-- CreateTable
CREATE TABLE "task_events" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "status" "TaskStatus",
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_events_task_id_idx" ON "task_events"("task_id");

-- CreateIndex
CREATE INDEX "task_events_created_at_idx" ON "task_events"("created_at");

-- AddForeignKey
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
