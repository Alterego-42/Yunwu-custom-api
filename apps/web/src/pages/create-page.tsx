import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Download, ExternalLink, Image as ImageIcon, Wand2, X } from "lucide-react";

import { TaskCard } from "@/components/cards/task-card";
import { Composer } from "@/components/chat/composer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import {
  formatAbsoluteTime,
  getTaskKnownAssetById,
  getTaskKnownAssets,
  getTaskComposerAssets,
  getTaskFailureDescription,
  getTaskIntentMode,
  resolveAssetUrl,
  summarizeParams,
  toUiTask,
} from "@/lib/api-mappers";
import type {
  AssetRecord,
  CapabilityType,
  ModelRecord,
  TaskRecord,
} from "@/lib/api-types";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

function createSelectedAssetPlaceholder(task: TaskRecord, assetId: string): AssetRecord {
  return {
    id: assetId,
    taskId: task.id,
    type: "generated",
    url: "",
    createdAt: task.updatedAt ?? task.createdAt,
  };
}

function SelectedAssetLightbox({
  asset,
  assetUrl,
  onClose,
}: {
  asset: AssetRecord;
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

  const label = asset.width && asset.height ? `${asset.width} × ${asset.height}` : asset.mimeType ?? asset.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} 预览`}
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground">{asset.id}</p>
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
          <img src={assetUrl} alt={label} className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain" />
        </div>
      </div>
    </div>
  );
}

function SelectedAssetPreview({ asset }: { asset?: AssetRecord }) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const assetUrl = asset ? resolveAssetUrl(asset.url, asset.storageKey) : undefined;
  const label =
    asset?.width && asset.height
      ? `${asset.width} × ${asset.height}`
      : asset?.mimeType ?? asset?.id ?? "未选择素材";

  return (
    <>
      <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container-lowest))]">
        <div className="relative min-h-0 flex-1">
          {assetUrl && asset ? (
            <button
              type="button"
              className="flex h-full w-full items-center justify-center bg-black/20"
              aria-label={`预览再编辑图片 ${label}`}
              onClick={() => setIsPreviewOpen(true)}
            >
              <img src={assetUrl} alt={label} className="max-h-full max-w-full object-contain" />
            </button>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center">
              <ImageIcon className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[hsl(var(--outline-variant)/0.72)] px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{label}</p>
            {asset ? <p className="truncate text-xs text-muted-foreground">{asset.id}</p> : null}
          </div>
          {assetUrl ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={assetUrl} download rel="noreferrer">
                  <Download className="h-4 w-4" />
                  下载
                </a>
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <a href={assetUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  原图
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {isPreviewOpen && asset && assetUrl ? (
        <SelectedAssetLightbox
          asset={asset}
          assetUrl={assetUrl}
          onClose={() => setIsPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}

export function CreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromTaskId = searchParams.get("fromTaskId") ?? undefined;
  const sourceAssetId = searchParams.get("assetId") ?? undefined;
  const requestedMode = searchParams.get("mode");
  const fork = searchParams.get("fork") === "1";

  const [models, setModels] = useState<ModelRecord[]>([]);
  const [sourceTask, setSourceTask] = useState<TaskRecord>();
  const [selectedAssets, setSelectedAssets] = useState<AssetRecord[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const mode = useMemo(() => {
    if (requestedMode === "variant") {
      return "variant" as const;
    }

    return "edit" as const;
  }, [requestedMode]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [modelList, task] = await Promise.all([
          apiClient.listModels(),
          fromTaskId ? apiClient.getTask(fromTaskId) : Promise.resolve(undefined),
        ]);

        if (cancelled) {
          return;
        }

        setModels(modelList);
        setSourceTask(task);

        if (task) {
          const knownAssets = getTaskKnownAssets(task, []);
          const selectedSourceAsset = sourceAssetId
            ? getTaskKnownAssetById(task, sourceAssetId, knownAssets)
            : undefined;

          setSelectedAssets(
            sourceAssetId
              ? [
                  selectedSourceAsset ??
                    createSelectedAssetPlaceholder(task, sourceAssetId),
                ]
              : getTaskComposerAssets(task, knownAssets),
          );
        } else {
          setSelectedAssets([]);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(getErrorMessage(nextError));
          setModels([]);
          setSourceTask(undefined);
          setSelectedAssets([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [fromTaskId, sourceAssetId]);

  const initialDraft = useMemo(() => {
    if (!sourceTask) {
      return undefined;
    }

    return {
      prompt: sourceTask.prompt,
      model: sourceTask.modelId,
      capability:
        sourceTask.failure?.category === "invalid_request"
          ? sourceTask.capability
          : mode === "variant" || mode === "edit"
            ? ("image.edit" as CapabilityType)
            : sourceTask.capability,
      params: sourceTask.params,
      batchCount: 1,
    };
  }, [mode, sourceTask]);

  const composerHint = useMemo(() => {
    if (!sourceTask) {
      return "提交成功后会直接进入对应工作台。";
    }

    if (sourceTask.failure?.category === "invalid_request") {
      return `来源失败：${getTaskFailureDescription(sourceTask)} · 将沿用原参数并允许你调整后继续。`;
    }

    return `${fork ? "将 Fork 为新会话" : "默认沿用原会话"} · ${summarizeParams(sourceTask.params)}`;
  }, [fork, sourceTask]);

  const sourceTaskAssets = useMemo(
    () => (sourceTask ? getTaskKnownAssets(sourceTask, selectedAssets) : selectedAssets),
    [selectedAssets, sourceTask],
  );
  const selectedPreviewAsset = useMemo(() => {
    if (!sourceTask) {
      return selectedAssets[0];
    }

    if (sourceAssetId) {
      return sourceTaskAssets.find((asset) => asset.id === sourceAssetId) ?? selectedAssets[0];
    }

    return selectedAssets[0] ?? sourceTaskAssets.find((asset) => asset.type === "generated");
  }, [selectedAssets, sourceAssetId, sourceTask, sourceTaskAssets]);

  const handleUpload = useCallback(async (file: File) => {
    setUploadError(null);
    setIsUploading(true);

    try {
      const response = await apiClient.uploadAsset(file);
      setSelectedAssets((current) =>
        current.some((asset) => asset.id === response.asset.id)
          ? current
          : [...current, response.asset],
      );
    } catch (nextError) {
      const message = getErrorMessage(nextError);
      setUploadError(message);
      throw nextError;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleRemoveUpload = useCallback((assetId: string) => {
    setSelectedAssets((current) => current.filter((asset) => asset.id !== assetId));
    setUploadError(null);
  }, []);

  const handleSubmit = useCallback(
    async (input: {
      prompt: string;
      model: string;
      capability: CapabilityType;
      assetIds?: string[];
      params?: Record<string, unknown>;
      batchCount?: number;
    }) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const response = await apiClient.createTask({
          conversationId: sourceTask && !fork ? sourceTask.conversationId : undefined,
          capability: input.capability,
          model: input.model,
          prompt: input.prompt,
          assetIds: input.assetIds,
          params: input.params,
          batchCount: input.batchCount,
          sourceTaskId: sourceTask?.id,
          sourceAction: sourceTask ? (fork ? "fork" : mode === "variant" ? "variant" : "edit") : undefined,
          fork,
        });

        navigate(`/workspace/${response.conversation.id}`);
      } catch (nextError) {
        setError(getErrorMessage(nextError));
      } finally {
        setIsSubmitting(false);
      }
    },
    [fork, mode, navigate, sourceTask],
  );

  if (sourceTask) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:h-[calc(100dvh-104px)] lg:min-h-[620px] lg:overflow-hidden">
        <Card className="shrink-0">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              <CardTitle>发起创作</CardTitle>
            </div>
            <CardDescription>
              {composerHint}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3 pt-0 text-sm text-muted-foreground">
            <span>模式：{mode === "variant" ? "生成变体" : "再编辑 / 调整后继续"}</span>
            <span>去向：{fork ? "新工作台" : sourceTask.conversationTitle ?? "新工作台"}</span>
            <span>来源：{sourceTask.id}</span>
          </CardContent>
        </Card>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.92fr)]">
          <Card className="flex min-h-[360px] min-w-0 flex-col overflow-hidden lg:min-h-0">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle>再编辑图片</CardTitle>
              <CardDescription>{selectedPreviewAsset?.id ?? "未选择素材"}</CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 overflow-hidden">
              <SelectedAssetPreview asset={selectedPreviewAsset} />
            </CardContent>
          </Card>

          <Card className="flex min-h-[420px] min-w-0 flex-col overflow-hidden lg:min-h-0">
            <CardHeader className="shrink-0 pb-3">
              <CardTitle>来源任务</CardTitle>
              <CardDescription>
                更新时间 {formatAbsoluteTime(sourceTask.updatedAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-4 overflow-auto">
              <TaskCard task={toUiTask(sourceTask, sourceTaskAssets)} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/workspace/${sourceTask.conversationId ?? ""}`)}>
                  返回来源工作台
                </Button>
                {sourceTask.failure?.category === "invalid_request" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/create?fromTaskId=${sourceTask.id}&mode=${getTaskIntentMode(sourceTask)}`)}
                  >
                    保持当前恢复模式
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="sticky bottom-3 z-20 shrink-0">
          {error ? (
            <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <Composer
            models={models}
            disabled={loading || isSubmitting}
            uploads={selectedAssets}
            uploadError={uploadError}
            isUploading={isUploading}
            initialDraft={initialDraft}
            submitLabel={fork ? "Fork 并提交" : "提交并进入工作台"}
            placeholder="输入提示词或调整说明，提交后进入工作台。"
            onUpload={handleUpload}
            onRemoveUpload={handleRemoveUpload}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <CardTitle>发起创作</CardTitle>
          </div>
          <CardDescription>
            输入提示词、上传参考图或基于历史任务继续，提交后进入工作台查看进展和结果。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span>模式：{mode === "variant" ? "生成变体" : "再编辑 / 调整后继续"}</span>
            <span>去向：新工作台</span>
          </div>
          <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] px-4 py-3 text-sm text-muted-foreground">
            {composerHint}
          </div>
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Composer
        models={models}
        disabled={loading || isSubmitting}
        uploads={selectedAssets}
        uploadError={uploadError}
        isUploading={isUploading}
        initialDraft={initialDraft}
        submitLabel={fork ? "Fork 并提交" : "提交并进入工作台"}
        placeholder="输入提示词或调整说明，提交后进入工作台。"
        onUpload={handleUpload}
        onRemoveUpload={handleRemoveUpload}
        onSubmit={handleSubmit}
      />

      {!loading && !sourceTask ? (
        <Card className="border-dashed bg-[hsl(var(--surface-container-low)/0.82)]">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm font-medium text-foreground">准备开始</p>
              <p className="mt-1 text-sm text-muted-foreground">
                直接提交即可，工作台会自动打开并展示进展。
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/")}>
              返回入口
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
