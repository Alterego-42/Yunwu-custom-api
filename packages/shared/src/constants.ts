export const CAPABILITY_TYPES = [
  "image.generate",
  "image.edit",
  "image.mask_edit",
  "image.describe",
  "image.upscale",
  "image.background_replace",
  "image.blend",
  "task.query",
  "midjourney.action"
] as const;

export const TASK_STATUSES = [
  "queued",
  "submitted",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
  "action_required"
] as const;

export const MESSAGE_TYPES = [
  "text",
  "image_result",
  "image_grid",
  "task_card",
  "upload_card",
  "action_card",
  "error_card",
  "system_notice"
] as const;

export const MODEL_TYPES = [
  "image-generation",
  "image-editing",
  "image-understanding"
] as const;

export const ASSET_TYPES = [
  "upload",
  "generated"
] as const;
