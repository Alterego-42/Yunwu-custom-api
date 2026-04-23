export enum TaskStatus {
  Queued = "queued",
  Submitted = "submitted",
  Running = "running",
  Succeeded = "succeeded",
  Failed = "failed",
  Cancelled = "cancelled",
  Expired = "expired",
  ActionRequired = "action_required",
}

export interface TaskStatusDto {
  id: string;
  status: TaskStatus;
  progress?: number;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}
