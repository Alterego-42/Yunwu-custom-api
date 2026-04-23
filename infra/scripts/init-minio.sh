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

mc alias set local "${scheme}://${endpoint}:${port}" "${root_user}" "${root_password}"
mc mb --ignore-existing "local/${bucket}"
mc anonymous set private "local/${bucket}"

echo "MinIO bucket '${bucket}' is ready."
