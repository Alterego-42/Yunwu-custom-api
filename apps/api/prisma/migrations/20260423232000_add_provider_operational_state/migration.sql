CREATE TABLE "provider_operational_state" (
    "id" TEXT NOT NULL,
    "last_check_status" TEXT,
    "last_check_at" TIMESTAMP(3),
    "last_check_latency_ms" INTEGER,
    "last_check_error" JSONB,
    "models_source" TEXT,
    "remote_models_snapshot" JSONB,
    "last_test_task_id" TEXT,
    "last_test_status" "TaskStatus",
    "last_test_at" TIMESTAMP(3),
    "last_test_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_operational_state_pkey" PRIMARY KEY ("id")
);
