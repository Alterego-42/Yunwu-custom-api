ALTER TABLE "provider_operational_state"
ADD COLUMN "active_alerts" JSONB,
ADD COLUMN "last_acknowledged_at" TIMESTAMP(3);
