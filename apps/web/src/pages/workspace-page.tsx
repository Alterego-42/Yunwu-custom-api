import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { ChatPanel } from "@/components/chat/chat-panel";
import { DetailPanel } from "@/components/chat/detail-panel";
import { SessionList } from "@/components/chat/session-list";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import {
  getTaskComposerAssets,
  getTaskIntentMode,
  isTaskActive,
  summarizeParams,
  toConversationSummary,
  toUiTask,
} from "@/lib/api-mappers";
import type {
  AssetRecord,
  CapabilityType,
  ConversationDetail,
  ConversationSummary,
  ModelRecord,
  TaskRecord,
  UiTask,
} from "@/lib/api-types";

type ConnectionMode = "sse" | "polling" | "connecting" | "idle";

type ComposerContext = {
  prompt?: string;
  model?: string;
  capability?: CapabilityType;
  params?: Record<string, unknown>;
  sourceTaskId?: string;
  sourceAction?: "edit" | "variant" | "fork";
  fork?: boolean;
  hint?: string;
  submitLabel?: string;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

function getPollingDelay(tasks: TaskRecord[]) {
  if (tasks.some((task) => task.status === "running")) {
    return 1500;
  }

  if (tasks.some((task) => task.status === "submitted")) {
    return 2000;
  }

  return 2500;
}

export function WorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const routeConversationId =
    typeof params.conversationId === "string" ? params.conversationId : undefined;
  const isRouteDriven = Boolean(routeConversationId);

  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [fallbackActiveId, setFallbackActiveId] = useState<string>();
  const [activeSession, setActiveSession] = useState<ConversationDetail>();
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<AssetRecord[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("idle");
  const [composerContext, setComposerContext] = useState<ComposerContext | null>(null);
  const activeSessionRef = useRef<ConversationDetail | undefined>(undefined);
  const refreshPromiseRef = useRef<{
    conversationId: string;
    promise: Promise<ConversationDetail>;
  } | null>(null);

  const activeId = routeConversationId ?? fallbackActiveId;

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    setSelectedAssets([]);
    setComposerContext(null);
    setUploadError(null);
  }, [activeId]);

  const applyConversation = useCallback((conversation: ConversationDetail) => {
    setActiveSession(conversation);
    setSessions((current) => {
      const summary = toConversationSummary(conversation);
      const exists = current.some((item) => item.id === conversation.id);

      if (!exists) {
        return [summary, ...current];
      }

      return current.map((item) => (item.id === conversation.id ? { ...item, ...summary } : item));
    });
  }, []);

  const refreshConversation = useCallback(
    async (conversationId: string, options?: { silent?: boolean }) => {
      if (refreshPromiseRef.current?.conversationId === conversationId) {
        return refreshPromiseRef.current.promise;
      }

      const request = (async () => {
        if (!options?.silent) {
          setDetailLoading(true);
        }

        setDetailError(null);

        try {
          const conversation = await apiClient.getConversation(conversationId);
          applyConversation(conversation);
          return conversation;
        } catch (error) {
          setDetailError(getErrorMessage(error));
          throw error;
        } finally {
          if (!options?.silent) {
            setDetailLoading(false);
          }
          if (refreshPromiseRef.current?.conversationId === conversationId) {
            refreshPromiseRef.current = null;
          }
        }
      })();

      refreshPromiseRef.current = {
        conversationId,
        promise: request,
      };

      return request;
    },
    [applyConversation],
  );

  const loadInitialData = useCallback(async () => {
    setListLoading(true);
    setListError(null);

    try {
      const [conversationList, modelList] = await Promise.all([
        apiClient.listConversations(),
        apiClient.listModels(),
      ]);

      setSessions(conversationList);
      setModels(modelList);
      setFallbackActiveId((current) => current ?? (!routeConversationId ? conversationList[0]?.id : current));
    } catch (error) {
      setListError(`${getErrorMessage(error)}（API: ${apiClient.getBaseUrl()}）`);
      setSessions([]);
      setModels([]);
    } finally {
      setListLoading(false);
    }
  }, [routeConversationId]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!activeId) {
      setActiveSession(undefined);
      return;
    }

    let ignore = false;

    refreshConversation(activeId).catch(() => {
      if (!ignore) {
        setActiveSession(undefined);
      }
    });

    return () => {
      ignore = true;
    };
  }, [activeId, refreshConversation]);

  const activePollingKey = useMemo(
    () =>
      activeSession && activeSession.id === activeId
        ? activeSession.tasks
            .filter(isTaskActive)
            .map((task) => `${task.id}:${task.status}:${task.updatedAt}`)
            .join("|")
        : "",
    [activeId, activeSession],
  );

  useEffect(() => {
    if (!activeId) {
      setConnectionMode("idle");
      return;
    }

    setConnectionMode("connecting");
    const eventSource = new EventSource(apiClient.getConversationEventsUrl(activeId), {
      withCredentials: true,
    });
    let disposed = false;

    eventSource.onopen = () => {
      if (!disposed) {
        setConnectionMode("sse");
      }
    };

    eventSource.onmessage = () => {
      if (!disposed) {
        void refreshConversation(activeId, { silent: true });
      }
    };

    eventSource.onerror = () => {
      if (!disposed) {
        setConnectionMode("polling");
      }
    };

    return () => {
      disposed = true;
      eventSource.close();
    };
  }, [activeId, refreshConversation]);

  useEffect(() => {
    if (!activeId || !activePollingKey || connectionMode === "sse") {
      return;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const scheduleNext = () => {
      const currentSession = activeSessionRef.current;
      if (!currentSession || currentSession.id !== activeId || !currentSession.tasks.some(isTaskActive)) {
        return;
      }

      timeoutId = window.setTimeout(poll, getPollingDelay(currentSession.tasks));
    };

    const poll = async () => {
      if (cancelled) {
        return;
      }

      try {
        await refreshConversation(activeId, { silent: true });
      } catch {
        // Keep current UI state and retry on next tick.
      }

      if (!cancelled) {
        setConnectionMode((current) => (current === "sse" ? current : "polling"));
        scheduleNext();
      }
    };

    scheduleNext();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeId, activePollingKey, connectionMode, refreshConversation]);

  const taskRecordById = useMemo(
    () => new Map((activeSession?.tasks ?? []).map((task) => [task.id, task])),
    [activeSession],
  );

  const uiTasks = useMemo(
    () => activeSession?.tasks.map((task) => toUiTask(task, activeSession.assets)) ?? [],
    [activeSession],
  );

  const queueLength = uiTasks.filter((task) =>
    ["queued", "submitted", "running"].includes(task.status),
  ).length;

  const primeComposerFromTask = useCallback(
    (task: TaskRecord, mode: "edit" | "variant", fork = false) => {
      const relatedAssets = getTaskComposerAssets(task, activeSession?.assets ?? []);

      setSelectedAssets(relatedAssets);
      setComposerContext({
        prompt: task.prompt,
        model: task.modelId,
        capability:
          mode === "edit" || relatedAssets.length > 0
            ? "image.edit"
            : task.capability,
        params: task.params,
        sourceTaskId: task.id,
        sourceAction: fork ? "fork" : mode,
        fork,
        submitLabel: fork ? "Fork 并提交" : mode === "variant" ? "生成变体" : "继续创作",
        hint: `${fork ? "将从来源任务 Fork 新会话" : "已按来源任务预填"} · ${summarizeParams(task.params)}`,
      });
    },
    [activeSession],
  );

  const handleCreateSession = useCallback(async () => {
    if (isRouteDriven) {
      navigate("/create");
      return;
    }

    setListError(null);
    try {
      const conversation = await apiClient.createConversation({
        title: `新会话 ${new Date().toLocaleTimeString()}`,
      });
      applyConversation(conversation);
      setFallbackActiveId(conversation.id);
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  }, [applyConversation, isRouteDriven, navigate]);

  const handleSelectSession = useCallback(
    (conversationId: string) => {
      if (isRouteDriven) {
        navigate(`/workspace/${conversationId}`);
        return;
      }

      setFallbackActiveId(conversationId);
    },
    [isRouteDriven, navigate],
  );

  const handleUploadAsset = useCallback(
    async (file: File) => {
      setUploadError(null);
      setIsUploading(true);

      try {
        const response = await apiClient.uploadAsset(file, activeId ? { conversationId: activeId } : {});
        setSelectedAssets((current) =>
          current.some((asset) => asset.id === response.asset.id)
            ? current
            : [...current, response.asset],
        );
        setActiveSession((current) =>
          current
            ? {
                ...current,
                assets: current.assets.some((asset) => asset.id === response.asset.id)
                  ? current.assets
                  : [...current.assets, response.asset],
              }
            : current,
        );
      } catch (error) {
        const message = getErrorMessage(error);
        setUploadError(message);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [activeId],
  );

  const handleRemoveUpload = useCallback((assetId: string) => {
    setSelectedAssets((current) => current.filter((asset) => asset.id !== assetId));
    setUploadError(null);
  }, []);

  const resetComposer = useCallback(() => {
    setSelectedAssets([]);
    setComposerContext(null);
  }, []);

  const handleSubmitTask = useCallback(
    async (input: {
      prompt: string;
      model: string;
      capability: CapabilityType;
      assetIds?: string[];
      params?: Record<string, unknown>;
    }) => {
      if (!activeId && !composerContext?.fork) {
        throw new Error("请先选择会话。");
      }

      setDetailError(null);
      const response = await apiClient.createTask({
        conversationId: activeId,
        capability: input.capability,
        model: input.model,
        prompt: input.prompt,
        assetIds: input.assetIds,
        params: input.params,
        sourceTaskId: composerContext?.sourceTaskId,
        sourceAction: composerContext?.sourceAction,
        fork: composerContext?.fork,
      });

      applyConversation(response.conversation);
      setSessions((current) => {
        const next = toConversationSummary(response.conversation);
        const withoutExisting = current.filter((item) => item.id !== next.id);
        return [next, ...withoutExisting];
      });

      if (response.conversation.id !== activeId) {
        if (location.pathname.startsWith("/workspace/")) {
          navigate(`/workspace/${response.conversation.id}`);
        } else {
          setFallbackActiveId(response.conversation.id);
        }
      } else {
        void refreshConversation(response.conversation.id, { silent: true });
      }

      resetComposer();
    },
    [activeId, applyConversation, composerContext, location.pathname, navigate, refreshConversation, resetComposer],
  );

  const handleRetryTask = useCallback(
    async (task: TaskRecord) => {
      await apiClient.retryTask(task.id);
      if (task.conversationId) {
        await refreshConversation(task.conversationId, { silent: true });
      }
    },
    [refreshConversation],
  );

  const renderTaskActions = useCallback(
    (uiTask: UiTask) => {
      const task = taskRecordById.get(uiTask.id);
      if (!task) {
        return null;
      }

      const actions: ReactNode[] = [];

      if (task.status === "succeeded") {
        actions.push(
          <Button key={`${task.id}-edit`} size="sm" variant="outline" onClick={() => primeComposerFromTask(task, "edit")}>
            再编辑
          </Button>,
        );
        actions.push(
          <Button key={`${task.id}-variant`} size="sm" variant="outline" onClick={() => primeComposerFromTask(task, "variant")}>
            生成变体
          </Button>,
        );
        actions.push(
          <Button key={`${task.id}-fork`} size="sm" onClick={() => primeComposerFromTask(task, "variant", true)}>
            Fork 新会话
          </Button>,
        );
      }

      if (task.status === "failed" && task.canRetry) {
        actions.push(
          <Button key={`${task.id}-retry`} size="sm" onClick={() => void handleRetryTask(task)}>
            一键重试
          </Button>,
        );
      }

      if (task.status === "failed" && task.failure?.category === "invalid_request") {
        actions.push(
          <Button
            key={`${task.id}-recover`}
            size="sm"
            variant="outline"
            onClick={() => primeComposerFromTask(task, getTaskIntentMode(task))}
          >
            调整后继续
          </Button>,
        );
      }

      return actions.length > 0 ? actions : null;
    },
    [handleRetryTask, primeComposerFromTask, taskRecordById],
  );

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div className="grid h-[calc(100vh-220px)] min-h-[640px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SessionList
          sessions={sessions}
          activeId={activeId}
          isLoading={listLoading}
          error={listError}
          onCreate={handleCreateSession}
          onSelect={handleSelectSession}
        />
        <ChatPanel
          session={activeSession}
          models={models}
          isLoading={detailLoading}
          error={detailError}
          uploadError={uploadError}
          uploads={selectedAssets}
          isUploading={isUploading}
          tasks={uiTasks}
          connectionMode={connectionMode}
          composerDraft={composerContext ?? undefined}
          composerSubmitLabel={composerContext?.submitLabel}
          composerHint={composerContext?.hint ?? null}
          onResetComposer={composerContext ? resetComposer : undefined}
          onUpload={handleUploadAsset}
          onRemoveUpload={handleRemoveUpload}
          onSubmitTask={handleSubmitTask}
          renderTaskActions={renderTaskActions}
        />
      </div>
      <DetailPanel tasks={uiTasks} queueLength={queueLength} renderTaskActions={renderTaskActions} />
    </div>
  );
}
