-- 上一版把 enabled_model_ids_by_route 声明成了 JSON，
-- Prisma 的 SQLite raw 查询无法转换该类型（Conversion failed: Value JSON not supported），
-- 这里按基线里其它 JSON 列的写法改回 JSONB，并保留已写入的数据。
ALTER TABLE "user_settings" ADD COLUMN "enabled_model_ids_by_route_jsonb" JSONB;

UPDATE "user_settings"
SET "enabled_model_ids_by_route_jsonb" = "enabled_model_ids_by_route";

ALTER TABLE "user_settings" DROP COLUMN "enabled_model_ids_by_route";

ALTER TABLE "user_settings" RENAME COLUMN "enabled_model_ids_by_route_jsonb" TO "enabled_model_ids_by_route";
