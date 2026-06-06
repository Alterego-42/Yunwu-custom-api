# Codex Architecture Frame: Batch Concurrent Image Requests

Updated: 2026-06-06

This frame describes the current working-tree architecture after the batch concurrent image request implementation and the homepage layout polish. It replaces the earlier proposal-style frame with the implementation facts that matter for handoff.

## 1. Current State

The batch feature is implemented in the local working tree, not yet a clean baseline commit.

Core behavior now in code:

- `batchCount` is accepted on task creation, clamped/validated to `1..20`.
- `batchCount > 1` creates one visible parent `Task` and durable `TaskBatchItem` rows.
- Batch parent tasks are routed to a separate BullMQ queue.
- Normal task worker concurrency defaults to `50`.
- Batch parent worker concurrency defaults to `2`.
- Each active batch parent runs its target slots concurrently with `Promise.allSettled`.
- Successful batch assets remain attached to the parent task through `Asset.taskId`.
- Batch assets carry `batchTaskId`, `batchItemId`, and `batchIndex` in metadata.
- Workspace, library, home, history, and admin surfaces include batch-aware display.
- Batch library items are grouped by parent task instead of exploding into one card per image.
- Batch fork is rejected.
- Batch re-edit requires selecting one successful image.
- Batch retry supports in-place failed-slot retry with `batchRetryCount=0` and new retry rounds with `batchRetryCount>0`.

Latest targeted verification in this handoff:

- `pnpm --filter @yunwu/web exec vitest run src/test/home-page.test.tsx --environment jsdom`
- Result: 7 tests passed.
- User-side frontend acceptance on port `5173` confirmed the homepage layout fix.

Full repository verification was not rerun during the homepage polish turn.

## 2. Data Model

Implemented Prisma changes live in:

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/migrations/20260605190000_add_task_batch_items/migration.sql`

The key durable model is:

```prisma
model TaskBatchItem {
  id              String     @id @default(cuid())
  taskId          String     @map("task_id")
  batchIndex      Int        @map("batch_index")
  status          TaskStatus @default(queued)
  progress        Int        @default(0)
  assetId         String?    @map("asset_id")
  errorMessage    String?    @map("error_message")
  attempt         Int        @default(0)
  providerSummary Json?      @map("provider_summary")
  output          Json?
  startedAt       DateTime?  @map("started_at")
  completedAt     DateTime?  @map("completed_at")
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")
  task            Task       @relation(fields: [taskId], references: [id], onDelete: Cascade)
  asset           Asset?     @relation(fields: [assetId], references: [id], onDelete: SetNull)

  @@unique([taskId, batchIndex])
  @@index([taskId])
  @@index([status])
  @@map("task_batch_items")
}
```

Relations added:

- `Task.batchItems TaskBatchItem[]`
- `Asset.batchItems TaskBatchItem[]`

No new `TaskStatus` enum value was introduced. Partial success is represented as parent `status=succeeded` plus `batch.partialSuccess=true`.

## 3. Shared And API Types

Implemented shared types live in `packages/shared/src/types.ts`.

Important additions:

- `TaskBatchSummary`
- `TaskBatchItemRecord`
- `TaskRecord.batch`
- `TaskRecord.batchItems`
- `CreateTaskInput.batchCount`
- `RetryTaskInput.batchRetryCount`
- `AssetRecord.batchIndex`
- `AssetRecord.batchItemId`

The web app mirrors these in `apps/web/src/lib/api-types.ts`, including:

- `UiBatchSlot`
- `UiTask.batch`
- `UiTask.batchSlots`

## 4. Backend API Flow

### Task Creation

Implemented mainly in:

- `apps/api/src/api/dto/create-task.dto.ts`
- `apps/api/src/api/api.service.ts`
- `apps/api/src/api/api.controller.ts`

`CreateTaskDto` validates:

```ts
batchCount?: number; // integer 1..20
```

`ApiService.createTask` now:

1. Normalizes missing `batchCount` to `1`.
2. Validates capability/model/provider settings as before.
3. Loads and validates source task when present.
4. Rejects fork from a batch source task.
5. Requires a selected successful batch asset for batch-source edit/variant actions.
6. Creates the user message and parent task in one transaction.
7. Creates `TaskBatchItem` rows for indexes `0..batchCount-1` when `batchCount > 1`.
8. Writes `batch.queued` for batch parents or `queued` for single tasks.
9. Enqueues the parent on the batch queue or normal queue.
10. Publishes a conversation update event.

### Retry

Implemented mainly in:

- `apps/api/src/api/dto/retry-task.dto.ts`
- `apps/api/src/api/api.service.ts`

`RetryTaskDto` validates:

```ts
batchRetryCount?: number; // integer 0..20
```

Current compatibility behavior:

- Non-batch retry keeps the existing retry flow.
- Batch retry with omitted `batchRetryCount` defaults to `1`.
- Batch retry with `0` resets only failed slots on the same parent and requeues that parent with `dedupe: false`.
- Batch retry with `1..20` creates a new parent task in the same conversation with `sourceAction=retry` and fresh batch item rows.

The frontend should continue sending an explicit value for batch retries.

### Serialization

`ApiService.toTaskRecord` now includes:

- `batch`
- `batchItems`
- batch-aware `outputSummary`
- generated asset IDs sorted by `batchIndex`
- asset metadata for `batchIndex` and `batchItemId`

`toTaskBatchSummary` prefers live `TaskBatchItem` rows. It can fall back to persisted output fields when rows are absent.

## 5. Queue And Worker Architecture

Implemented files:

- `apps/api/src/config/configuration.ts`
- `apps/api/src/tasks/task-queue.service.ts`
- `apps/api/src/tasks/task-worker.service.ts`
- `apps/api/src/tasks/task-queue-recovery.service.ts`

Runtime config:

```ts
tasks: {
  queueName: process.env.TASK_QUEUE_NAME ?? "yunwu-image-tasks",
  batchQueueName: process.env.TASK_BATCH_QUEUE_NAME ?? "yunwu-image-batch-tasks",
  workerConcurrency: Number(process.env.TASK_WORKER_CONCURRENCY ?? process.env.TASK_QUEUE_CONCURRENCY ?? 50),
  batchWorkerConcurrency: Number(process.env.TASK_BATCH_WORKER_CONCURRENCY ?? 2),
}
```

`TaskQueueService` owns two queues:

- `enqueueTask(taskId, source)` for normal work.
- `enqueueBatchTask(taskId, source, { dedupe })` for batch parents.

`TaskWorkerService` starts two BullMQ workers over the same Redis connection:

- Normal worker: default concurrency `50`.
- Batch worker: default concurrency `2`.

Both workers call `TaskExecutionService.execute(taskId)`. The execution service decides whether the task is single or batch from `input.batchCount` and `batchItems`.

Recovery routing:

- Active non-batch tasks are requeued to the normal queue.
- Active batch parents or tasks with batch items are requeued to the batch queue.

## 6. Batch Execution Flow

Implemented in `apps/api/src/tasks/task-execution.service.ts`.

High-level path:

1. `execute(taskId)` loads task, conversation, assets, and ordered batch items.
2. Terminal tasks return early.
3. Tasks with `input.batchCount > 1` or existing `batchItems` enter `executeBatchTask`.
4. Target items are those in `queued`, `submitted`, or `running`.
5. Parent is marked `submitted`, then `running`.
6. Target items are marked `running`, `attempt` is incremented, and timestamps are updated.
7. Provider request summary is recorded as `batch.provider.request`.
8. All target items are executed concurrently:

```ts
await Promise.allSettled(
  targetItems.map((item) => this.executeBatchItem(task, item, context)),
);
```

Per-slot success:

- Calls the OpenAI-compatible provider.
- Stores generated output through `AssetStorageService`.
- Creates one generated `Asset` attached to the parent task.
- Writes batch metadata onto the asset.
- Updates the `TaskBatchItem` to `succeeded`.
- Refreshes parent output summary and progress.
- Records `batch.item.succeeded`.
- Publishes a conversation update.

Per-slot failure:

- Uses the existing failure classifier.
- Updates the `TaskBatchItem` to `failed`.
- Stores sanitized provider summary/output where available.
- Refreshes parent output summary and progress.
- Records `batch.item.failed`.
- Publishes a conversation update.

Final parent status:

- `succeeded` if at least one slot succeeded.
- `failed` if all slots failed.
- `partialSuccess=true` when at least one slot succeeded and at least one failed.
- Parent `errorMessage` is populated only for all-failed batches.
- One assistant message is created for the batch outcome.

Parent progress:

```ts
20 + Math.round((returnedCount / batchSize) * 75)
```

Terminal progress is `100`.

## 7. Library, Home, History, And Admin Surfaces

Backend surfaces include ordered batch items and generated assets:

- `getHome`
- `getHistory`
- `getLibrary`
- admin task responses/details

Library grouping is implemented by `ApiService.toLibraryItemRecords`:

- Non-batch tasks keep `kind: "single"`.
- Batch tasks return one `kind: "batch"` item per parent task.
- Representative asset is the first successful generated asset by `batchIndex`.
- `assets` contains all successful generated assets sorted by `batchIndex`.

Home behavior:

- Recent conversations are fetched independently from recent/recovery tasks.
- Recent tasks use compact `TaskCard` rendering.
- Batch recent tasks show compact batch counts and hide direct continue actions.
- Batch recovery tasks hide one-click retry and direct users back to the workspace.

The latest homepage layout polish in `apps/web/src/pages/home-page.tsx`:

- Changed the recent conversation and failure recovery area to an equal-width, top-aligned two-column grid at `lg`.
- Reworked recovery cards so long prompts, badges, details, and action buttons do not fight for the same horizontal space.
- Conversation rows now use clamped title/summary text with the timestamp in a stable side column.

## 8. Frontend Architecture

Key files:

- `apps/web/src/components/chat/composer.tsx`
- `apps/web/src/components/chat/chat-panel.tsx`
- `apps/web/src/components/cards/task-card.tsx`
- `apps/web/src/components/cards/batch-result-modal.tsx`
- `apps/web/src/components/cards/library-item-card.tsx`
- `apps/web/src/lib/api-client.ts`
- `apps/web/src/lib/api-mappers.ts`
- `apps/web/src/pages/create-page.tsx`
- `apps/web/src/pages/workspace-page.tsx`
- `apps/web/src/pages/home-page.tsx`
- `apps/web/src/pages/history-page.tsx`
- `apps/web/src/pages/library-page.tsx`
- `apps/web/src/pages/admin-page.tsx`

Composer:

- Adds a `并发次数` numeric input.
- Clamps values to `1..20`.
- Passes `batchCount` through create/workspace/chat submission flows.
- Re-edit from a selected batch image resets the draft batch count to `1`.

API client:

- `createTask` sends `batchCount`.
- `retryTask(id, { batchRetryCount })` sends JSON when a retry body is supplied.

Mappers:

- Detect batch tasks.
- Build `batchSlots` by joining batch item records to generated assets.
- Preserve stable slot order by `batchIndex`.
- Mark partial-success batches as displayable when they have real successful assets.

Task card:

- Shows batch summary badges.
- Shows first failure reason.
- Shows slot grid for full cards.
- Shows compact batch counts for compact cards.
- Opens `BatchResultModal` for successful batch results.
- Hides Fork behavior for batch tasks through caller-provided actions.

Batch result modal:

- Shows successful images in stable order.
- Supports preview/lightbox, download, open original, and re-edit.
- Does not expose Fork.

Create/workspace pages:

- Carry `batchCount` through task submission.
- Support selected batch asset re-edit through `assetId`.
- Batch re-edit selection uses the chosen asset as the only reference image.

## 9. Eventing

Batch execution continues to use conversation-level refresh events. The important task event names now include:

- `batch.queued`
- `batch.submitted`
- `batch.running`
- `batch.provider.request`
- `batch.item.succeeded`
- `batch.item.failed`
- `batch.retry_failed_slots_requested`
- `batch.succeeded`
- `batch.failed`

The frontend still refreshes conversation detail after task update events.

## 10. Compatibility Rules

Preserved behavior:

- Existing clients that omit `batchCount` still create normal single tasks.
- Existing non-batch retry calls without a body still work.
- Existing single-task cards, library items, and history rows still render.
- Existing task statuses are reused.

New batch constraints:

- Batch parent tasks cannot be forked.
- Batch source edit/variant requires a selected successful image asset.
- Batch retry should provide an explicit retry count.
- Batch generated assets must remain scoped by `userId` and parent `taskId`.

## 11. Verification Map

Backend tests added/updated:

- `apps/api/test/task-flow.test.ts`
- `apps/api/test/task-execution.test.ts`

Frontend tests added/updated:

- `apps/web/src/test/composer.test.tsx`
- `apps/web/src/test/create-page.test.tsx`
- `apps/web/src/test/home-page.test.tsx`
- `apps/web/src/test/library-page.test.tsx`
- `apps/web/src/test/task-card.test.tsx`
- `apps/web/src/test/admin-page.test.tsx`
- `apps/web/src/test/api-mappers.test.ts`
- `apps/web/src/test/history-page.test.tsx`

Useful commands:

```powershell
pnpm --filter @yunwu/web exec vitest run src/test/home-page.test.tsx --environment jsdom
pnpm --filter @yunwu/web test:routes
pnpm --filter @yunwu/api exec node --require ts-node/register --test "test/*.test.ts" "src/logging/app-logger.service.spec.ts"
pnpm lint
pnpm local:test
```

For future visual checks, the user's active frontend was on `http://127.0.0.1:5173/` during acceptance. Do not start or stop that port unless the user asks.

## 12. Handoff Notes

- `codex-pm.md` remains the product plan; this file is the current implementation frame.
- The working tree is intentionally dirty with batch feature changes and the homepage layout polish.
- `codex-frame.md` and `codex-pm.md` are currently untracked handoff documents.
- Be careful with unrelated dirty files; treat them as existing feature work, not disposable changes.
- The most recent user-facing issue was homepage layout: recent sessions and failure recovery looked unbalanced. The applied fix is in `apps/web/src/pages/home-page.tsx` and was accepted by the user on the running frontend.
