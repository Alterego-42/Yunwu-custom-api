import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  Clock3,
  Download,
  ExternalLink,
  Image as ImageIcon,
  LoaderCircle,
  X,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSourceActionLabel, resolveAssetUrl } from "@/lib/api-mappers";
import type { UiTask, UiTaskRoundNavigation } from "@/lib/api-types";
import { cn } from "@/lib/utils";

type TaskRoundNavigation = UiTaskRoundNavigation & {
  onPrevious?: () => void;
  onNext?: () => void;
};

const statusLabel: Record<UiTask["status"], string> = {
  queued: "排队中",
  submitted: "已提交",
  running: "执行中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
  expired: "已过期",
  action_required: "待处理",
};

const statusToneMap: Record<UiTask["status"], string> = {
  queued: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  submitted: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  running: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  succeeded: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelled: "border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container-high)/0.8)] text-muted-foreground",
  expired: "border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container-high)/0.8)] text-muted-foreground",
  action_required: "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100",
};

function TaskStatusIcon({ status }: { status: UiTask["status"] }) {
  if (status === "queued" || status === "submitted" || status === "running") {
    return <LoaderCircle className="h-3.5 w-3.5 animate-spin" />;
  }

  if (status === "succeeded") {
    return <CheckCircle2 className="h-3.5 w-3.5" />;
  }

  if (status === "action_required") {
    return <AlertTriangle className="h-3.5 w-3.5" />;
  }

  if (status === "failed" || status === "cancelled" || status === "expired") {
    return <XCircle className="h-3.5 w-3.5" />;
  }

  return <CircleDashed className="h-3.5 w-3.5" />;
}

function TaskRoundSwitcher({ navigation }: { navigation?: TaskRoundNavigation }) {
  if (!navigation || navigation.total <= 1) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] px-3 py-2 text-xs text-muted-foreground"
      data-testid="task-round-switcher"
    >
      <span className="shrink-0">重试轮次</span>
      <div className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container-high)/0.8)] px-1 py-0.5">
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[hsl(var(--surface-container-highest)/0.9)] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="上一重试轮次"
          disabled={!navigation.previousTaskId || !navigation.onPrevious}
          onClick={navigation.onPrevious}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[2.5rem] text-center font-medium tabular-nums text-foreground">
          {navigation.index}/{navigation.total}
        </span>
        <button
          type="button"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition hover:bg-[hsl(var(--surface-container-highest)/0.9)] hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          aria-label="下一重试轮次"
          disabled={!navigation.nextTaskId || !navigation.onNext}
          onClick={navigation.onNext}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function TaskAssetLightbox({
  asset,
  assetUrl,
  onClose,
}: {
  asset: NonNullable<UiTask["resultAssets"]>[number];
  assetUrl: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${asset.label} 预览`}
      onClick={onClose}
      data-testid="task-asset-lightbox"
    >
      <div
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{asset.label}</p>
            <p className="text-xs text-muted-foreground">{asset.mimeType ?? asset.type}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={assetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-3 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              打开原图
            </a>
            <a
              href={assetUrl}
              download
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/10 px-3 text-xs text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            >
              <Download className="h-3.5 w-3.5" />
              下载
            </a>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              aria-label="关闭图片预览"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-0 overflow-auto bg-black/30 p-4">
          <img src={assetUrl} alt={asset.label} className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain" />
        </div>
      </div>
    </div>
  );
}

export function TaskAssetPreview({
  asset,
}: {
  asset: NonNullable<UiTask["resultAssets"]>[number];
}) {
  const assetUrl = resolveAssetUrl(asset.url);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const content = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden border-b border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container-lowest))]">
        {assetUrl ? (
          <img
            src={assetUrl}
            alt={asset.label}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-foreground">{asset.label}</p>
          <p className="text-[11px] text-muted-foreground">{asset.mimeType ?? asset.type}</p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
    </>
  );

  if (assetUrl) {
    return (
      <>
        <button
          type="button"
          className="group overflow-hidden rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] text-left"
          aria-label={`预览素材 ${asset.label}`}
          onClick={() => setIsPreviewOpen(true)}
        >
          {content}
        </button>
        {isPreviewOpen ? (
          <TaskAssetLightbox asset={asset} assetUrl={assetUrl} onClose={() => setIsPreviewOpen(false)} />
        ) : null}
      </>
    );
  }

  return <div className="overflow-hidden rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)]">{content}</div>;
}

function TaskInputAssetPreview({
  asset,
  assetUrl,
}: {
  asset: NonNullable<UiTask["inputAssets"]>[number];
  assetUrl: string;
}) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
        aria-label={`预览参考素材 ${asset.label}`}
        onClick={() => setIsPreviewOpen(true)}
      >
        <ImageIcon className="h-3.5 w-3.5" />
        <span>{asset.label}</span>
      </button>
      {isPreviewOpen ? (
        <TaskAssetLightbox asset={asset} assetUrl={assetUrl} onClose={() => setIsPreviewOpen(false)} />
      ) : null}
    </>
  );
}

export function TaskCard({
  task,
  compact = false,
  actions,
  roundNavigation,
  isFocused = false,
}: {
  task: UiTask;
  compact?: boolean;
  actions?: ReactNode;
  roundNavigation?: TaskRoundNavigation;
  isFocused?: boolean;
}) {
  const isActive = task.status === "queued" || task.status === "submitted" || task.status === "running";
  const hasResults = Boolean(task.resultAssets?.length);
  const hasInputs = Boolean(task.inputAssets?.length);

  return (
    <Card
      className={cn(
        "transition-shadow",
        isFocused ? "ring-1 ring-primary/60 shadow-lg shadow-primary/10" : null,
      )}
    >
      <CardHeader className={compact ? "pb-3" : "pb-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TaskStatusIcon status={task.status} />
              <span>{task.capability ?? "任务"}</span>
            </div>
            <CardTitle className="mt-2 line-clamp-2 text-base">{task.title}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{task.id}</p>
          </div>
          <Badge variant="outline" className={statusToneMap[task.status]}>
            {statusLabel[task.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {task.summary ? (
          <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] px-3 py-2 text-sm text-foreground">
            {task.summary}
          </div>
        ) : null}

        {task.errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            失败原因：{task.errorMessage}
          </div>
        ) : null}

        {task.failure ? (
          <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] px-3 py-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">
                {task.failure.title ?? "失败恢复"}
              </span>
              <Badge variant="outline">{task.failure.category}</Badge>
              <Badge
                variant="outline"
                className={
                  task.failure.retryable
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                    : "border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container-high)/0.8)] text-muted-foreground"
                }
              >
                {task.failure.retryable ? "可重试" : "需调整参数"}
              </Badge>
            </div>
            {task.failure.detail ? <p className="mt-2">{task.failure.detail}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {task.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
          {task.sourceAction ? (
            <Badge variant="outline">{getSourceActionLabel(task.sourceAction)}</Badge>
          ) : null}
          {task.sourceTaskId ? (
            <Badge variant="outline" className="max-w-full truncate">
              来源 {task.sourceTaskId}
            </Badge>
          ) : null}
        </div>

        {!compact && hasResults ? (
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground">结果素材</div>
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {task.resultAssets?.map((asset) => <TaskAssetPreview key={asset.id} asset={asset} />)}
            </div>
          </div>
        ) : null}

        {compact && hasResults ? (
          <div className="text-xs text-muted-foreground">结果素材 {task.resultAssets?.length} 项</div>
        ) : null}

        {!compact && hasInputs ? (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">参考素材</div>
            <div className="flex flex-wrap gap-2">
              {task.inputAssets?.map((asset) => {
                const assetUrl = resolveAssetUrl(asset.url);

                return assetUrl ? (
                  <TaskInputAssetPreview
                    key={asset.id}
                    asset={asset}
                    assetUrl={assetUrl}
                  />
                ) : (
                  <div
                    key={asset.id}
                    className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] px-3 py-1 text-xs text-muted-foreground"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>{asset.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {compact && hasInputs ? (
          <div className="text-xs text-muted-foreground">参考素材 {task.inputAssets?.length} 项</div>
        ) : null}

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}

        <TaskRoundSwitcher navigation={roundNavigation} />

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isActive ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clock3 className="h-3.5 w-3.5" />
          )}
          <span>{task.eta}</span>
        </div>
      </CardContent>
    </Card>
  );
}
