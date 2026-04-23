import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Clock3,
  ExternalLink,
  Image as ImageIcon,
  LoaderCircle,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UiTask } from "@/lib/api-types";

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
  cancelled: "border-white/10 bg-white/[0.06] text-muted-foreground",
  expired: "border-white/10 bg-white/[0.06] text-muted-foreground",
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

export function TaskAssetPreview({
  asset,
}: {
  asset: NonNullable<UiTask["resultAssets"]>[number];
}) {
  const content = (
    <>
      <div className="relative aspect-[4/3] overflow-hidden border-b border-white/10 bg-white/[0.03]">
        {asset.url ? (
          <img
            src={asset.url}
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

  if (asset.url) {
    return (
      <a
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        className="group overflow-hidden rounded-xl border border-white/10 bg-black/20"
      >
        {content}
      </a>
    );
  }

  return <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">{content}</div>;
}

export function TaskCard({
  task,
  compact = false,
}: {
  task: UiTask;
  compact?: boolean;
}) {
  const isActive = task.status === "queued" || task.status === "submitted" || task.status === "running";
  const hasResults = Boolean(task.resultAssets?.length);
  const hasInputs = Boolean(task.inputAssets?.length);

  return (
    <Card className="border-white/10 bg-white/[0.03]">
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
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>进度</span>
            <span>{task.progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div
              className={cn(
                "h-2 rounded-full transition-all",
                task.status === "succeeded"
                  ? "bg-emerald-400"
                  : task.status === "failed" || task.status === "cancelled" || task.status === "expired"
                    ? "bg-destructive"
                    : "bg-primary",
              )}
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>

        {task.summary ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-foreground">
            {task.summary}
          </div>
        ) : null}

        {task.errorMessage ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            失败原因：{task.errorMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {task.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>

        {!compact && hasResults ? (
          <div className="space-y-3">
            <div className="text-xs font-medium text-muted-foreground">结果素材</div>
            <div className="grid gap-3 sm:grid-cols-2">
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
              {task.inputAssets?.map((asset) =>
                asset.url ? (
                  <a
                    key={asset.id}
                    href={asset.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>{asset.label}</span>
                  </a>
                ) : (
                  <div
                    key={asset.id}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-muted-foreground"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>{asset.label}</span>
                  </div>
                ),
              )}
            </div>
          </div>
        ) : null}

        {compact && hasInputs ? (
          <div className="text-xs text-muted-foreground">参考素材 {task.inputAssets?.length} 项</div>
        ) : null}

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
