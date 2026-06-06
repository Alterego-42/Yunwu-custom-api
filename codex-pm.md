# Codex PM Plan: Batch Concurrent Image Requests

## 1. Background

Yunwu Custom API currently treats every image generation or edit submission as one visible task card. Users who want multiple variations from the same prompt must submit the same request repeatedly, which is slow, noisy in the workspace, and difficult to review in the library.

This round adds first-class batch concurrent requests. A user can set a concurrency count in the existing composer, submit one request, and receive multiple concurrently generated results grouped into a single task card.

## 2. Product Goal

Allow users to run the same image request concurrently within the current conversation and collect all successful outputs in a compact, inspectable batch card.

The finished feature must feel like an ordinary part of the current workflow:

- It appears in every existing composer entry point.
- It does not create extra conversations unless the existing action explicitly does so.
- It does not flood the workspace, history, home page, or library with one card per result.
- It provides real-time batch progress and failure visibility.
- It supports batch-aware retry behavior.

## 3. Confirmed Requirements

### 3.1 Composer Entry

Every place that shows the editing composer must include a `并发次数` control:

- First task creation.
- Continuing in an existing workspace conversation.
- Re-editing a result.
- Creating variants.
- Failure recovery.
- Editing one image chosen from a batch result modal.

The control must support:

- Minimum: `1`.
- Maximum: `20`.
- Default: `1`.
- Manual numeric input.
- Wheel or stepper adjustment where the local UI component supports it.

When `并发次数=1`, existing single-request behavior remains visually and functionally unchanged.

When `并发次数>1`, one batch task card is created.

### 3.2 Batch Execution

For a batch request with count `N`:

- The system creates one visible batch task card in the current conversation.
- The batch contains `N` internal execution slots.
- All `N` upstream provider requests in the batch must be sent truly concurrently.
- Results are ordered by stable `batchIndex`, not by completion time.
- Each slot independently reaches a terminal state.
- The parent batch task reaches a terminal state only after all slots are terminal.

### 3.3 Global Concurrency Policy

The existing effective "only two tasks at a time" behavior must be removed for normal single requests.

New target behavior:

- Single requests are no longer product-limited to two simultaneous tasks.
- Batch parent tasks are globally limited to at most `2` actively processing batch tasks.
- Inside one active batch task, all slots must run concurrently according to that task's `并发次数`.

Implementation may still use a high configurable worker concurrency for engineering safety, but product behavior must no longer artificially serialize normal single tasks to two at a time.

### 3.4 Batch Card Display

A batch card must show real-time status:

- Total batch size.
- Returned count.
- Success count.
- Loading count.
- Failed count.
- First failure reason, if any slot failed.

Suggested wording:

- `共 8 个`
- `已返回 5`
- `成功 4`
- `处理中 3`
- `失败 1`
- `首个失败：Provider rate limited.`

A slot is considered returned when it has reached a terminal state: success or failure.

### 3.5 Parent Batch Status

The parent batch task status is determined after all slots are terminal:

- All slots failed: parent `failed`.
- At least one slot succeeded and at least one failed: parent `succeeded` in storage, shown as `部分完成` in UI.
- All slots succeeded: parent `succeeded`.

This avoids adding a new database enum while still giving users clear partial-success semantics.

### 3.6 Retry Behavior

Batch retry is different from single-task retry.

When the user clicks retry on a batch task, the UI shows a compact numeric input:

- Label: `重试次数` or `重试并发数`.
- Range: `0-20`.
- Supports direct input and wheel/stepper adjustment.

Retry semantics:

- `0`: no new round is created. Only failed slots in the current batch card are retried in place. Failed thumbnails become loading again while they rerun.
- `1-20`: create a new retry round as a new batch task card in the same conversation. The new batch task uses the entered number as its concurrency count. It reuses the original prompt, model, reference images, params, capability, provider base URL, and retry source chain.

The `0` path updates the existing batch card.

The `>0` path reuses the existing retry lineage pattern:

- New visible task card.
- `sourceTaskId` points to the previous batch task.
- `sourceAction=retry`.
- Same conversation unless current retry logic changes globally in the future.

### 3.7 Batch Re-edit And Fork Rules

Batch task cards cannot be forked.

Batch re-edit opens a batch result modal first. The user must choose one successful image. After choosing:

- The selected image becomes the only reference image for the next edit.
- The original prompt, model, and params are prefilled.
- The composer `并发次数` resets to `1`.
- The user may change `并发次数` to `2-20`, making the re-edit itself a new batch request.

There is no `Fork` button inside the batch result modal.

### 3.8 Library Behavior

All successful images from a batch enter the library.

The library must aggregate them into one batch library card instead of rendering one card per image.

The batch library card should show:

- A representative preview or thumbnail grid.
- Batch size.
- Success count.
- Failed count, if the source batch partially failed.
- Source prompt and model.
- Source task link when available.

Clicking the batch library card opens a medium-sized modal matching the existing UI style:

- Shows all successful images in stable `batchIndex` order.
- Each image has at least:
  - Re-edit.
  - Download.
  - Open original or preview.
- No Fork action.

### 3.9 Home, History, And Task Lists

Every task list surface must indicate whether a task is batch and how many items it contains:

- Home recent tasks.
- History page.
- Workspace session task list.
- Admin task list.
- Any compact task card.

Single tasks continue to display normally.

Batch tasks must not explode into separate task cards.

### 3.10 Permissions And Isolation

Batch behavior must preserve all existing isolation rules:

- A member can only see and retry their own batch tasks.
- A member can only access assets from their own batch outputs.
- Admin can inspect globally where current admin behavior allows it.
- Batch result modal must not leak another user's assets through referenced asset IDs.

## 4. Non-goals

This round does not implement:

- Batch fork.
- Cross-conversation batch result management.
- Selecting multiple batch images for one re-edit.
- Provider-specific batch APIs, if any exist upstream.
- Cost tracking or quota accounting.
- Cancellation of individual in-flight slots.
- A new task status enum such as `partial_success`.

## 5. User Stories

### Story 1: First Batch Generation

As a user, I enter a prompt, set `并发次数=6`, submit, and see one task card. The card shows six slots loading. As upstream calls finish, the success and failure counts update. Successful images appear in the card without creating six cards.

Acceptance:

- One visible task card.
- Six provider requests are sent concurrently.
- Counts update via SSE or polling.
- Successful images render in stable index order.

### Story 2: Partial Success

As a user, I submit a batch of 8. Five succeed and three fail. The task card shows `成功 5 / 失败 3`, and the first failure reason is visible.

Acceptance:

- Parent is stored as `succeeded`.
- UI label is `部分完成`.
- Five images enter library.
- Three failed slots remain visible inside the batch card/modal.

### Story 3: Retry Failed Slots In Place

As a user, I click retry on a partial batch and enter `0`. The failed thumbnails turn back to loading, successful thumbnails remain unchanged, and only failed slots are requested again.

Acceptance:

- No new task card is created.
- Only failed batch items rerun.
- Counts reset and update correctly for rerun slots.

### Story 4: New Retry Round

As a user, I click retry on a batch and enter `4`. A new retry task card appears in the same conversation with four concurrent requests using the original prompt and references.

Acceptance:

- New visible task card.
- `sourceTaskId` and `sourceAction=retry` are populated.
- New card batch size is 4.
- Original batch remains unchanged.

### Story 5: Batch Library Review

As a user, I open the library and see one card for a batch. I click it and inspect all images in a modal. I download one and re-edit another.

Acceptance:

- One library card per batch task.
- Modal shows successful images.
- Re-edit starts with the selected image as the only reference.
- No Fork action appears.

## 6. UX Requirements

### 6.1 Composer Control

Add the control near model, capability, and size:

- Label: `并发次数`.
- Input type: numeric stepper.
- Range: 1 to 20.
- Default: 1.
- Must fit on desktop and mobile without layout overlap.

When the user uploads reference images, the existing image edit forcing behavior remains. Batch count does not change capability resolution rules.

### 6.2 Batch Task Card

The card should reuse the existing `TaskCard` visual language.

Required sections:

- Header: prompt, status badge, model/capability tags.
- Batch summary strip: total, returned, success, loading, failed.
- First failure reason panel when present.
- Result grid with stable slot order.
- Failed slot placeholders with error text.
- Loading slot placeholders.
- Actions:
  - Retry with numeric retry count.
  - Open batch results.
  - Re-edit opens image selection modal.

No Fork action.

### 6.3 Batch Result Modal

The modal should be medium-sized, not full screen by default:

- Suggested max width: around existing large modal width, e.g. `max-w-5xl`.
- Scrollable content area.
- Responsive grid.
- Each image item has:
  - Preview.
  - Index label.
  - Download.
  - Re-edit.
  - Open original.

Failed slots may be shown in the task card, but the library modal only needs successful images unless the product later asks for failure inspection in library.

## 7. API Requirements

### 7.1 Create Task

Extend task creation payload:

```ts
{
  conversationId?: string;
  capability: CapabilityType;
  model: string;
  prompt: string;
  assetIds?: string[];
  params?: Record<string, unknown>;
  sourceTaskId?: string;
  sourceAction?: TaskSourceAction;
  fork?: boolean;
  batchCount?: number; // 1-20, default 1
}
```

For `batchCount=1`:

- Existing single-task behavior.

For `batchCount>1`:

- Create one parent task.
- Create internal batch item rows or equivalent durable records.
- Enqueue parent on batch queue.
- Return the same response shape plus batch metadata.

### 7.2 Retry Task

Extend retry endpoint to accept an optional body:

```ts
{
  batchRetryCount?: number; // 0-20
}
```

Behavior:

- Non-batch task: current retry behavior remains.
- Batch task + `batchRetryCount=0`: retry failed slots in place.
- Batch task + `batchRetryCount>0`: create new retry batch task with that count.
- Batch task + no body: front end should not call without a value; backend may default to current single-task behavior only for compatibility if needed.

## 8. Data Requirements

The system must durably store per-slot state. This can be a new table or an equivalent robust JSON strategy, but a table is preferred for queryability and correctness.

Each batch item needs:

- Parent task ID.
- Batch index.
- Status.
- Asset ID for success.
- Error message for failure.
- Started/completed timestamps.
- Sanitized provider response summary.
- Retry attempt metadata for in-place failed-slot retries.

The parent task must expose a computed or persisted batch summary:

- `isBatch`
- `batchSize`
- `returnedCount`
- `successCount`
- `failedCount`
- `loadingCount`
- `firstFailureMessage`
- `assetIds`

## 9. Testing Plan

### 9.1 Backend Unit Tests

Add tests for:

- `CreateTaskDto` validates `batchCount` range.
- `ApiService.createTask` creates one parent task for `batchCount>1`.
- Batch item rows are created with stable indexes.
- Batch parent is routed to batch queue.
- Single tasks still route to normal queue.
- Batch task execution sends all provider requests concurrently.
- Parent summary updates after each item.
- Partial success resolves parent status to stored `succeeded`.
- All-failed batch resolves parent status to `failed`.
- `batchRetryCount=0` reruns only failed items.
- `batchRetryCount>0` creates a new retry parent task.
- User isolation applies to batch task and batch assets.

### 9.2 Frontend Unit Tests

Add tests for:

- Composer renders and serializes `并发次数`.
- Default is 1.
- Range is constrained to 1-20.
- Workspace renders batch summary counts.
- Batch card shows first failure reason.
- Retry numeric control supports 0-20 and calls retry endpoint with body.
- Batch card hides Fork.
- Batch re-edit modal opens and selects one image.
- Library groups batch assets into one card.
- Library modal has re-edit/download and no Fork.
- Home/history compact cards display batch count.

### 9.3 Regression Tests

Run:

- `pnpm lint`
- `pnpm local:test`
- Full API node tests under `apps/api/test`.
- Full Web Vitest suite.
- Targeted browser smoke if UI layout changes are broad.

## 10. Rollout Milestones

### Milestone 1: Data And API Contract

- Add migration.
- Add shared/API types.
- Add DTO validation.
- Add batch-aware task records.
- Keep `batchCount=1` backward compatible.

### Milestone 2: Execution And Queueing

- Split or route single vs batch queues.
- Raise normal task concurrency.
- Limit active batch parent jobs to 2.
- Implement true concurrent slot execution.
- Implement parent summary updates and SSE publishing.

### Milestone 3: Workspace UI

- Add Composer control.
- Render batch card.
- Add batch retry numeric control.
- Add batch result modal.
- Wire selected-image re-edit.

### Milestone 4: Library/Home/History/Admin

- Batch badges/counts on all list surfaces.
- Batch aggregation in library.
- Batch modal in library.
- Admin visibility for batch metadata.

### Milestone 5: Tests And Polish

- Backend tests.
- Frontend tests.
- Visual regression pass.
- Documentation update if needed.

## 11. Risks And Mitigations

### Risk: Provider Rate Limits

Batch requests can spike upstream traffic.

Mitigation:

- Hard cap `batchCount` at 20.
- Limit active batch parent tasks to 2.
- Show provider failures clearly.

### Risk: Partial Success Semantics

Stored `succeeded` with visible `部分完成` could confuse code paths that assume success means all slots succeeded.

Mitigation:

- Expose explicit `batch.failedCount`.
- UI labels derive from batch summary.
- Library only includes successful assets.

### Risk: In-place Retry Complexity

Retrying failed slots in the same parent task can blur event history.

Mitigation:

- Record task events for `batch.retry_failed_slots_requested`.
- Track item attempt count and updated timestamps.
- Do not delete previous failure details until rerun starts; then replace failed slot with loading.

### Risk: Query Explosion In Library

Grouping assets by batch can require extra joins.

Mitigation:

- Keep `Asset.taskId` pointing to the batch parent task.
- Include batch summary on task records.
- Build library grouping around task ID, not ad hoc prompt matching.

## 12. Definition Of Done

The feature is done when:

- Users can set `并发次数` from 1 to 20 in every composer.
- Batch count greater than 1 produces one visible batch card.
- Batch slots send upstream requests truly concurrently.
- Only two batch parent tasks can actively process globally.
- Single tasks are no longer limited to two active tasks.
- Batch card shows real-time total/returned/success/loading/failed/first failure.
- Partial success is clearly displayed and persisted.
- Retry `0` reruns failed slots in place.
- Retry `1-20` creates a new retry batch card in the same conversation.
- Batch cards cannot fork.
- Batch re-edit requires choosing one successful image.
- Library groups successful batch outputs into one card and modal.
- Home, history, workspace, and admin lists mark batch tasks and counts.
- Existing single-task behavior and tests remain passing.
