import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ChatPanel } from "@/components/chat/chat-panel";
import { DetailPanel } from "@/components/chat/detail-panel";
import { SessionList } from "@/components/chat/session-list";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/api-mappers";
import type {
  AssetRecord,
  CapabilityType,
  ConversationDetail,
  ConversationSummary,
  ModelRecord,
  TaskEventRecord,
  TaskRecord,
  UiTask,
  UiTaskAsset,
} from "@/lib/api-types";

type ConnectionMode = "sse" | "polling" | "connecting" | "idle";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

const ACTIVE_TASK_STATUSES = new Set(["queued", "submitted", "running"]);

function isTaskActive(task: TaskRecord) {
  return ACTIVE_TASK_STATUSES.has(task.status);
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

function getTaskProgress(task: TaskRecord) {
  const apiProgress = (task as TaskRecord & { progress?: number }).progress;
  if (typeof apiProgress === "number") {
    return Math.min(100, Math.max(0, Math.round(apiProgress)));
  }

  switch (task.status) {
    case "queued":
      return 8;
    case "submitted":
      return 20;
    case "running":
      return 72;
    case "action_required":
      return 92;
    case "succeeded":
    case "failed":
    case "cancelled":
    case "expired":
      return 100;
    default:
      return 0;
  }
}

function toUiTaskAsset(asset: AssetRecord): UiTaskAsset {
  const size = asset.width && asset.height ? `${asset.width} × ${asset.height}` : undefined;

  return {
    id: asset.id,
    type: asset.type,
    url: asset.url,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    createdAt: asset.createdAt,
    label: size ?? asset.mimeType ?? asset.id,
  };
}

function toUiTask(task: TaskRecord, assets: AssetRecord[]): UiTask {
  const inputAssets = assets
    .filter((asset) => asset.type === "upload" && (task.assetIds?.includes(asset.id) || asset.taskId === task.id))
    .map(toUiTaskAsset);
  const resultAssets = assets
    .filter((asset) => asset.type === "generated" && asset.taskId === task.id)
    .map(toUiTaskAsset);
  const latestMessage = task.messages?.at(-1)?.content?.trim();
  const isTerminal =
    task.status === "succeeded" ||
    task.status === "failed" ||
    task.status === "cancelled" ||
    task.status === "expired";

  return {
    id: task.id,
    title: task.prompt || task.capability,
    prompt: task.prompt,
    progress: getTaskProgress(task),
    status: task.status,
    eta: isTerminal ? `更新于 ${formatRelativeTime(task.updatedAt)}` : `最近更新 ${formatRelativeTime(task.updatedAt)}`,
    tags: [task.capability, task.modelId].filter(Boolean),
    capability: task.capability,
    model: task.modelId,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    errorMessage: task.errorMessage,
    summary: latestMessage && latestMessage !== task.errorMessage ? latestMessage : undefined,
    inputAssets,
    resultAssets,
  };
}

function mergeConversationTask(conversation: ConversationDetail, task: TaskRecord) {
  const existingIndex = conversation.tasks.findIndex((item) => item.id === task.id);

  if (existingIndex >= 0) {
    const tasks = [...conversation.tasks];
    tasks[existingIndex] = {
      ...tasks[existingIndex],
      ...task,
    };

    return {
      ...conversation,
      tasks,
    };
  }

  return {
    ...conversation,
    tasks: [task, ...conversation.tasks],
  };
}

function toConversationSummary(conversation: ConversationDetail): ConversationSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    summary: conversation.messages.at(-1)?.content,
    status: conversation.tasks.some(isTaskActive)
      ? "running"
      : conversation.tasks.length > 0
        ? "done"
        : "idle",
    model: conversation.tasks[0]?.modelId,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

export function WorkspacePage() {
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [activeSession, setActiveSession] = useState<ConversationDetail>();
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedAssets, setUploadedAssets] = useState<AssetRecord[]>([]);
  const [taskEvents, setTaskEvents] = useState<TaskEventRecord[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [taskEventError, setTaskEventError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("idle");
  const activeSessionRef = useRef<ConversationDetail | undefined>(undefined);
  const refreshPromiseRef = useRef<{
    conversationId: string;
    promise: Promise<ConversationDetail>;
  } | null>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const applyConversation = useCallback((conversation: ConversationDetail, events?: TaskEventRecord[]) => {
    setActiveSession(conversation);
    setUploadedAssets(conversation.assets.filter((asset) => asset.type === "upload"));
    if (events) {
      setTaskEvents(events);
    }
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
          const [conversation, eventResult] = await Promise.all([
            apiClient.getConversation(conversationId),
            apiClient
              .listConversationTaskEvents(conversationId)
              .then((events) => ({ events }))
              .catch((error: unknown) => ({ error })),
          ]);

          if ("error" in eventResult) {
            setTaskEventError(`任务历史事件暂不可用：${getErrorMessage(eventResult.error)}`);
            applyConversation(conversation);
          } else {
            setTaskEventError(null);
            applyConversation(conversation, eventResult.events);
          }
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

  async function loadInitialData() {
    setListLoading(true);
    setListError(null);

    try {
      const [conversationList, modelList] = await Promise.all([
        apiClient.listConversations(),
        apiClient.listModels(),
      ]);

      setSessions(conversationList);
      setModels(modelList);
      setActiveId((current) => current ?? conversationList[0]?.id);
    } catch (error) {
      setListError(`${getErrorMessage(error)}（API: ${apiClient.getBaseUrl()}）`);
      setSessions([]);
      setModels([]);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!activeId) {
      setActiveSession(undefined);
      setUploadedAssets([]);
      setTaskEvents([]);
      setTaskEventError(null);
      return;
    }

    let ignore = false;
    setTaskEvents([]);
    setTaskEventError(null);

    refreshConversation(activeId).catch(() => {
      if (!ignore) {
        setActiveSession(undefined);
        setTaskEvents([]);
      }
    });

    return () => {
      ignore = true;
    };
  }, [activeId, refreshConversation]);

  const activePollingKey = useMemo(
    () =>
      activeSession?.id === activeId
        ? activeSession?.tasks
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
    if (!activeId || !activePollingKey) {
      return;
    }

    if (connectionMode === "sse") {
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
        // Keep current UI data and retry on the next scheduled tick.
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

  async function handleCreateSession() {
    setListError(null);

    try {
      const conversation = await apiClient.createConversation({
        title: `新会话 ${new Date().toLocaleTimeString()}`,
      });

      applyConversation(conversation, []);
      setActiveId(conversation.id);
    } catch (error) {
      setListError(getErrorMessage(error));
    }
  }

  async function handleUploadAsset(file: File) {
    if (!activeId) {
      throw new Error("请先选择或创建会话。");
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const response = await apiClient.uploadAsset(file, { conversationId: activeId });
      setUploadedAssets((current) => {
        if (current.some((asset) => asset.id === response.asset.id)) {
          return current;
        }

        return [...current, response.asset];
      });
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
  }

  function handleRemoveUpload(assetId: string) {
    setUploadedAssets((current) => current.filter((asset) => asset.id !== assetId));
    setUploadError(null);
  }

  async function handleSubmitTask(input: {
    prompt: string;
    model: string;
    capability: CapabilityType;
    assetIds?: string[];
  }) {
    if (!activeId) {
      throw new Error("请先选择或创建会话。");
    }

    setDetailError(null);

    const response = await apiClient.createTask({
      conversationId: activeId,
      capability: input.capability,
      model: input.model,
      prompt: input.prompt,
      assetIds: input.assetIds,
    });

    applyConversation(mergeConversationTask(response.conversation, response.task));
    void refreshConversation(activeId, { silent: true });
  }

  const uiTasks = useMemo(
    () => activeSession?.tasks.map((task) => toUiTask(task, activeSession.assets)) ?? [],
    [activeSession],
  );
  const queueLength = uiTasks.filter((task) =>
    ["queued", "submitted", "running"].includes(task.status),
  ).length;

  return (
    <div className="grid h-[calc(100vh-136px)] min-h-[720px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
      <SessionList
        sessions={sessions}
        activeId={activeId}
        isLoading={listLoading}
        error={listError}
        onCreate={handleCreateSession}
        onSelect={setActiveId}
      />
      <ChatPanel
        session={activeSession}
        models={models}
        isLoading={detailLoading}
        error={detailError}
        uploadError={uploadError}
        taskEventError={taskEventError}
        uploads={uploadedAssets}
        isUploading={isUploading}
        tasks={uiTasks}
        taskEvents={taskEvents}
        connectionMode={connectionMode}
        onUpload={handleUploadAsset}
        onRemoveUpload={handleRemoveUpload}
        onSubmitTask={handleSubmitTask}
      />
      <DetailPanel tasks={uiTasks} queueLength={queueLength} />
    </div>
  );
}
