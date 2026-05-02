CREATE TABLE "provider_configuration" (
    "id" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configuration_pkey" PRIMARY KEY ("id")
);
