#!/bin/sh
set -eu

endpoint="${MINIO_INTERNAL_ENDPOINT:-minio}"
port="${MINIO_INTERNAL_PORT:-9000}"
root_user="${MINIO_ROOT_USER:-minioadmin}"
root_password="${MINIO_ROOT_PASSWORD:-minioadmin}"
bucket="${MINIO_BUCKET:-yunwu-assets}"
use_ssl="${MINIO_USE_SSL:-false}"

scheme="http"
if [ "$use_ssl" = "true" ]; then
  scheme="https"
fi

attempt=1
until mc alias set local "${scheme}://${endpoint}:${port}" "${root_user}" "${root_password}"; do
  if [ "$attempt" -ge 30 ]; then
    echo "Failed to connect to MinIO after ${attempt} attempts."
    exit 1
  fi
  echo "Waiting for MinIO to accept credentials (${attempt}/30)..."
  attempt=$((attempt + 1))
  sleep 2
done

attempt=1
until mc mb --ignore-existing "local/${bucket}"; do
  if [ "$attempt" -ge 10 ]; then
    echo "Failed to ensure MinIO bucket '${bucket}' after ${attempt} attempts."
    exit 1
  fi
  echo "Waiting to create MinIO bucket '${bucket}' (${attempt}/10)..."
  attempt=$((attempt + 1))
  sleep 2
done

if ! mc anonymous set private "local/${bucket}"; then
  echo "Warning: failed to set bucket '${bucket}' anonymous policy to private; continuing because bucket exists."
fi

echo "MinIO bucket '${bucket}' is ready."
