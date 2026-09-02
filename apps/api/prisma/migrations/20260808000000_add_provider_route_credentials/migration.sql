-- 三条固定线路 + 按线路隔离的用户 API key。
ALTER TABLE "user_settings" ADD COLUMN "active_provider_route_id" TEXT NOT NULL DEFAULT 'apixo';
ALTER TABLE "user_settings" ADD COLUMN "enabled_model_ids_by_route" JSONB;

CREATE TABLE IF NOT EXISTS "user_provider_credentials" (
  "user_id" TEXT NOT NULL,
  "provider_route_id" TEXT NOT NULL,
  "api_key" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL,
  PRIMARY KEY ("user_id", "provider_route_id"),
  CONSTRAINT "user_provider_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_provider_credentials_user_id_idx" ON "user_provider_credentials" ("user_id");

-- 旧 base_url 归属线路：yunwu.ai / api.yunwu.ai / api3.wlai.vip 都算 Yunwu 线路。
UPDATE "user_settings" SET "active_provider_route_id" = CASE
  WHEN replace(rtrim("base_url", '/'), '/v1', '') IN ('https://anyaigc.com', 'https://www.anyaigc.com') THEN 'anyaigc'
  WHEN replace(rtrim("base_url", '/'), '/v1', '') IN ('https://yunwu.ai', 'https://api.yunwu.ai', 'https://api3.wlai.vip') THEN 'yunwu'
  ELSE 'apixo'
END;

-- 已保存的旧密钥迁移到它原本所属的线路，其它线路保持未配置。
INSERT OR IGNORE INTO "user_provider_credentials" ("user_id", "provider_route_id", "api_key", "created_at", "updated_at")
SELECT "user_id", "active_provider_route_id", "provider_api_key", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "user_settings"
WHERE trim(COALESCE("provider_api_key", '')) <> '';

-- 密钥已迁出，清空旧列避免两处并存。
UPDATE "user_settings" SET "provider_api_key" = NULL;
