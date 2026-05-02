const normalizeS3Endpoint = () => {
  const s3Endpoint = process.env.S3_ENDPOINT;
  if (s3Endpoint) {
    return s3Endpoint;
  }

  const minioEndpoint = process.env.MINIO_ENDPOINT;
  if (!minioEndpoint) {
    return undefined;
  }

  if (/^https?:\/\//.test(minioEndpoint)) {
    return minioEndpoint;
  }

  const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";
  const hasPort = minioEndpoint.includes(":");
  const port = process.env.MINIO_PORT ?? "9000";
  return `${protocol}://${minioEndpoint}${hasPort ? "" : `:${port}`}`;
};

export const configuration = () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  webPort: Number(process.env.WEB_PORT ?? 5173),
  databaseUrl: process.env.DATABASE_URL,
  redisUrl: process.env.REDIS_URL,
  tasks: {
    queueName: process.env.TASK_QUEUE_NAME ?? "yunwu-image-tasks",
    eventsChannel: process.env.TASK_EVENTS_CHANNEL ?? "yunwu-image-task-events",
    workerEnabled:
      (process.env.TASK_WORKER_ENABLED ??
        process.env.TASK_QUEUE_ENABLED ??
        "true") !== "false",
    workerConcurrency: Number(
      process.env.TASK_WORKER_CONCURRENCY ??
        process.env.TASK_QUEUE_CONCURRENCY ??
        1,
    ),
  },
  cors: {
    origins: (
      process.env.CORS_ORIGIN ??
      process.env.WEB_ORIGIN ??
      `http://127.0.0.1:${process.env.WEB_PORT ?? 5173}`
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  auth: {
    cookieName: process.env.AUTH_COOKIE_NAME ?? "yunwu_session",
    sessionSecret:
      process.env.AUTH_SESSION_SECRET ?? "yunwu-dev-session-secret-change-me",
    sessionTtlHours: Number(process.env.AUTH_SESSION_TTL_HOURS ?? 168),
    cookieSecure: process.env.AUTH_COOKIE_SECURE,
    admin: {
      email: process.env.AUTH_ADMIN_EMAIL ?? "admin@yunwu.local",
      password: process.env.AUTH_ADMIN_PASSWORD ?? "admin123456",
      displayName: process.env.AUTH_ADMIN_DISPLAY_NAME ?? "Administrator",
    },
    demo: {
      email: process.env.AUTH_DEMO_EMAIL ?? "demo@yunwu.local",
      password: process.env.AUTH_DEMO_PASSWORD ?? "demo123456",
      displayName: process.env.AUTH_DEMO_DISPLAY_NAME ?? "Demo User",
    },
  },
  storage: {
    mode:
      process.env.STORAGE_MODE ??
      (process.env.S3_BUCKET || process.env.MINIO_BUCKET ? "s3" : "local"),
    local: {
      path: process.env.LOCAL_STORAGE_PATH ?? "./storage",
      publicBaseUrl: process.env.PUBLIC_ASSET_BASE_URL ?? undefined,
    },
    s3: {
      endpoint: normalizeS3Endpoint(),
      region: process.env.S3_REGION ?? process.env.AWS_REGION ?? "us-east-1",
      bucket: process.env.S3_BUCKET ?? process.env.MINIO_BUCKET,
      accessKeyId:
        process.env.S3_ACCESS_KEY_ID ??
        process.env.AWS_ACCESS_KEY_ID ??
        process.env.MINIO_ACCESS_KEY ??
        process.env.MINIO_ROOT_USER,
      secretAccessKey:
        process.env.S3_SECRET_ACCESS_KEY ??
        process.env.AWS_SECRET_ACCESS_KEY ??
        process.env.MINIO_SECRET_KEY ??
        process.env.MINIO_ROOT_PASSWORD,
      publicBaseUrl:
        process.env.S3_PUBLIC_BASE_URL ?? process.env.MINIO_PUBLIC_BASE_URL,
      forcePathStyle:
        (process.env.S3_FORCE_PATH_STYLE ??
          (process.env.MINIO_ENDPOINT ? "true" : "false")) === "true",
    },
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT,
    port: Number(process.env.MINIO_PORT ?? 9000),
    rootUser: process.env.MINIO_ROOT_USER,
    rootPassword: process.env.MINIO_ROOT_PASSWORD,
    bucket: process.env.MINIO_BUCKET,
    useSsl: process.env.MINIO_USE_SSL === "true",
  },
  yunwu: {
    providerName: process.env.YUNWU_PROVIDER_NAME,
    baseUrl: process.env.YUNWU_BASE_URL ?? "https://yunwu.ai",
    apiKey: process.env.YUNWU_API_KEY,
    allowMockImages: process.env.YUNWU_ALLOW_MOCK_IMAGES === "true",
  },
});
