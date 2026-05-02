import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Wand2 } from "lucide-react";

import { TaskCard } from "@/components/cards/task-card";
import { Composer } from "@/components/chat/composer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import {
  formatAbsoluteTime,
  getTaskComposerAssets,
  getTaskFailureDescription,
  getTaskIntentMode,
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

export function CreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromTaskId = searchParams.get("fromTaskId") ?? undefined;
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
          setSelectedAssets(getTaskComposerAssets(task, []));
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
  }, [fromTaskId]);

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
            <span>去向：{fork ? "新工作台" : sourceTask?.conversationTitle ?? "新工作台"}</span>
            {sourceTask ? <span>来源：{sourceTask.id}</span> : null}
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

      {sourceTask ? (
        <Card>
          <CardHeader>
            <CardTitle>来源任务</CardTitle>
            <CardDescription>
              更新时间 {formatAbsoluteTime(sourceTask.updatedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TaskCard task={toUiTask(sourceTask, selectedAssets)} />
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
