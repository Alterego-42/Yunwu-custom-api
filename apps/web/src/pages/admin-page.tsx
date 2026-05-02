import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/api-mappers";
import type {
  AdminLogRecord,
  AdminLogsResponse,
  AdminModelCapabilityRecord,
  AdminProviderAlert,
  AdminProviderModelAvailability,
  AdminProviderCheckResult,
  AdminProviderStatus,
  AdminProviderTestGenerateResult,
  AdminProviderWarning,
  ApiTask,
  TaskEventRecord,
} from "@/lib/api-types";
import { cn } from "@/lib/utils";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed. Please retry.";
}

const SENSITIVE_KEY_PATTERN = /api[-_ ]?key|authorization|bearer|password|secret|token/i;
const surfacePanelClass =
  "rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)]";
const surfaceInsetClass =
  "rounded-lg border border-[hsl(var(--outline-variant)/0.62)] bg-[hsl(var(--surface-container-low)/0.86)]";
const surfaceCodeClass =
  "rounded-lg border border-[hsl(var(--outline-variant)/0.56)] bg-[hsl(var(--surface-container-lowest)/0.92)]";
const selectedSurfaceClass = "bg-[hsl(var(--surface-container-high)/0.82)]";
const warningTextClass =
  "text-[color:color-mix(in_oklab,#d97706_58%,hsl(var(--foreground)))]";
const infoTextClass =
  "text-[color:color-mix(in_oklab,#0284c7_58%,hsl(var(--foreground)))]";
const successTextClass =
  "text-[color:color-mix(in_oklab,#059669_58%,hsl(var(--foreground)))]";

function sanitizeSensitiveText(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
    .replace(
      /\b(api[-_ ]?key|token|secret|password)\s*[:=]\s*["']?[^"',\s;]+/gi,
      "$1=[redacted]",
    )
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-[redacted]");
}

function getSafeErrorMessage(error: unknown) {
  return sanitizeSensitiveText(getErrorMessage(error));
}

function sanitizeJsonValue(value: unknown): unknown {
  if (typeof value === "string") {
    return sanitizeSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeJsonValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeJsonValue(entry),
      ]),
    );
  }

  return value;
}

function isEmptyJsonValue(value?: unknown) {
  return (
    value === undefined ||
    value === null ||
    (typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === 0)
  );
}

function shortId(value?: string) {
  if (!value) {
    return "-";
  }

  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function formatTimestamp(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderJson(value?: unknown) {
  if (isEmptyJsonValue(value)) {
    return <span className="text-muted-foreground">No summary.</span>;
  }

  return (
    <pre
      className={cn(
        surfaceCodeClass,
        "max-h-56 overflow-auto p-3 text-xs leading-relaxed text-muted-foreground",
      )}
    >
      {JSON.stringify(sanitizeJsonValue(value), null, 2)}
    </pre>
  );
}

function getHealthBadgeVariant(result?: AdminProviderCheckResult | null) {
  if (!result) {
    return "outline";
  }

  return result.ok ? "default" : "outline";
}

function getHealthStatusLabel(result?: AdminProviderCheckResult | null) {
  if (!result) {
    return "unknown";
  }

  if (result.status === "ok") {
    return "healthy";
  }

  if (result.status === "error") {
    return "unhealthy";
  }

  return result.status || (result.ok ? "healthy" : "unhealthy");
}

function getHealthSummary(result?: AdminProviderCheckResult | null) {
  if (!result) {
    return null;
  }

  return sanitizeSensitiveText(
    result.errorSummary || result.message || "No error summary.",
  );
}

function getTestTaskId(result?: AdminProviderTestGenerateResult | null) {
  return result?.taskId ?? result?.task?.id ?? null;
}

function getTestTimestamp(result?: AdminProviderTestGenerateResult | null) {
  return (
    result?.completedAt ??
    result?.createdAt ??
    result?.queuedAt ??
    result?.task?.updatedAt ??
    result?.task?.createdAt
  );
}

function getTestFailureSummary(result?: AdminProviderTestGenerateResult | null) {
  if (!result) {
    return null;
  }

  const summary =
    result.errorSummary ??
    result.failureSummary ??
    result.task?.errorMessage ??
    (result.ok === false ? result.message : undefined);

  return summary ? sanitizeSensitiveText(summary) : null;
}

function getProviderLabel(provider?: AdminProviderStatus | null) {
  if (!provider) {
    return "Provider";
  }

  return `${provider.name || "Provider"}${provider.type ? ` / ${provider.type}` : ""}`;
}

type ProviderModelAvailabilityItem = {
  key: string;
  model: string;
  name: string;
  status: "available" | "missing" | "unknown";
  message: string;
  capabilityTypes: string[];
};

function getAvailabilityStatus(
  item: AdminProviderModelAvailability,
): ProviderModelAvailabilityItem["status"] {
  const status = item.status ?? item.availability;

  if (status === "available") {
    return "available";
  }

  if (status === "missing") {
    return "missing";
  }

  if (status === "unknown") {
    return "unknown";
  }

  return "unknown";
}

function getAvailabilityMessage(
  status: ProviderModelAvailabilityItem["status"],
  item?: AdminProviderModelAvailability,
) {
  const message = item?.message ?? item?.hint ?? item?.reason;
  if (message) {
    return sanitizeSensitiveText(message);
  }

  if (status === "available") {
    return "Enabled model is reported as available by the provider.";
  }

  if (status === "missing") {
    return "Enabled locally, but not found in the latest provider model list.";
  }

  return "Availability is unknown until the provider reports model reachability.";
}

function getProviderModelAvailabilityItems(
  provider: AdminProviderStatus,
  capabilities: AdminModelCapabilityRecord[],
): ProviderModelAvailabilityItem[] {
  const enabledModels = new Set(
    capabilities
      .filter((item) => item.enabled)
      .map((item) => item.model)
      .filter(Boolean),
  );

  if (provider.modelAvailability?.length) {
    return provider.modelAvailability
      .filter((item) => {
        const model = item.model ?? item.modelId ?? item.id;
        return (
          item.enabled !== false &&
          (!enabledModels.size || item.enabled === true || Boolean(model && enabledModels.has(model)))
        );
      })
      .map((item) => {
        const model = item.model ?? item.modelId ?? item.id ?? "unknown";
        const status = getAvailabilityStatus(item);

        return {
          key: model,
          model,
          name: item.name ?? model,
          status,
          message: getAvailabilityMessage(status, item),
          capabilityTypes: item.capabilityTypes ?? [],
        };
      });
  }

  if (provider.models?.length) {
    return provider.models
      .filter((item) => item.enabled)
      .map((item) => {
        const status =
          item.remoteAvailable === true
            ? "available"
            : item.remoteAvailable === false
              ? "missing"
              : "unknown";

        return {
          key: item.id,
          model: item.id,
          name: item.name || item.id,
          status,
          message: getAvailabilityMessage(status),
          capabilityTypes: item.capabilityTypes,
        };
      });
  }

  const grouped = new Map<string, ProviderModelAvailabilityItem>();
  for (const item of capabilities) {
    if (!item.enabled) {
      continue;
    }

    const existing = grouped.get(item.model);
    grouped.set(item.model, {
      key: item.model,
      model: item.model,
      name: existing?.name ?? item.name ?? item.model,
      status: "unknown",
      message: getAvailabilityMessage("unknown"),
      capabilityTypes: [
        ...new Set([
          ...(existing?.capabilityTypes ?? []),
          ...item.capabilityTypes,
        ]),
      ],
    });
  }

  return [...grouped.values()];
}

function getAvailabilityBadgeClass(status: ProviderModelAvailabilityItem["status"]) {
  if (status === "available") {
    return undefined;
  }

  if (status === "missing") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }

  return cn("border-amber-400/30 bg-amber-400/10", warningTextClass);
}

function getProviderWarningText(warning: AdminProviderWarning) {
  if (typeof warning === "string") {
    return sanitizeSensitiveText(warning);
  }

  return sanitizeSensitiveText(
    warning.message ?? warning.title ?? warning.code ?? "Provider warning",
  );
}

type ProviderAlertSeverity = "critical" | "warning" | "info";
type AdminLogFilterLevel = "ALL" | "DEBUG" | "INFO" | "WARN" | "ERROR";

function isProviderAlertActive(alert: AdminProviderAlert) {
  const status = alert.status?.toLowerCase();
  return !alert.acknowledgedAt && status !== "acknowledged" && status !== "resolved";
}

function getProviderAlertSeverity(alert: AdminProviderAlert): ProviderAlertSeverity {
  const severity = alert.severity?.toLowerCase();

  if (severity === "critical" || severity === "error") {
    return "critical";
  }

  if (severity === "warning" || severity === "warn") {
    return "warning";
  }

  return "info";
}

function getProviderAlertTitle(alert: AdminProviderAlert) {
  return sanitizeSensitiveText(alert.title ?? alert.message ?? alert.id);
}

function getProviderAlertMessage(alert: AdminProviderAlert) {
  const message = alert.message?.trim();
  return message ? sanitizeSensitiveText(message) : null;
}

function getProviderAlertTimestamp(alert: AdminProviderAlert) {
  return (
    alert.detectedAt ??
    alert.triggeredAt ??
    alert.occurredAt ??
    alert.updatedAt ??
    alert.createdAt
  );
}

function getProviderAlertTaskId(alert: AdminProviderAlert) {
  return alert.taskId ?? alert.task?.id ?? null;
}

function getProviderAlertBadgeClass(severity: ProviderAlertSeverity) {
  if (severity === "critical") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }

  if (severity === "warning") {
    return cn("border-amber-400/30 bg-amber-400/10", warningTextClass);
  }

  return cn("border-sky-400/30 bg-sky-400/10", infoTextClass);
}

function getProviderAlertCardClass(severity: ProviderAlertSeverity) {
  if (severity === "critical") {
    return "border-destructive/30 bg-destructive/5";
  }

  if (severity === "warning") {
    return "border-amber-400/25 bg-amber-400/[0.04]";
  }

  return "border-sky-400/20 bg-sky-400/[0.03]";
}

function getProviderAlertSummary(provider?: AdminProviderStatus | null) {
  const alerts = (provider?.alerts ?? []).filter(isProviderAlertActive);
  const summary = provider?.summary;
  const count = (...values: Array<number | undefined>) =>
    values.find((value) => typeof value === "number") ?? 0;

  return {
    activeCount: count(
      summary?.activeAlerts,
      summary?.activeCount,
      summary?.totalActive,
      alerts.length,
    ),
    criticalCount: count(
      summary?.criticalAlerts,
      summary?.criticalCount,
      alerts.filter((alert) => getProviderAlertSeverity(alert) === "critical").length,
    ),
    warningCount: count(
      summary?.warningAlerts,
      summary?.warningCount,
      alerts.filter((alert) => getProviderAlertSeverity(alert) === "warning").length,
    ),
    infoCount: count(
      summary?.infoAlerts,
      summary?.infoCount,
      alerts.filter((alert) => getProviderAlertSeverity(alert) === "info").length,
    ),
  };
}

function mergeTaskIntoList(current: ApiTask[], task: ApiTask) {
  return [task, ...current.filter((item) => item.id !== task.id)].slice(
    0,
    Math.max(current.length, 50),
  );
}

async function fetchTaskDetail(id: string) {
  const [task, events] = await Promise.all([
    apiClient.getTask(id),
    apiClient.getTaskEvents(id),
  ]);

  return { task, events };
}

function getLogLevelBadgeClass(level: string) {
  const normalizedLevel = level.toUpperCase();

  if (normalizedLevel === "ERROR") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }

  if (normalizedLevel === "WARN" || normalizedLevel === "WARNING") {
    return cn("border-amber-400/30 bg-amber-400/10", warningTextClass);
  }

  if (normalizedLevel === "DEBUG") {
    return cn("border-sky-400/30 bg-sky-400/10", infoTextClass);
  }

  return cn("border-emerald-400/25 bg-emerald-400/[0.06]", successTextClass);
}

function formatLogTrace(trace: AdminLogRecord["trace"]) {
  if (!trace) {
    return null;
  }

  return typeof trace === "string"
    ? sanitizeSensitiveText(trace)
    : JSON.stringify(sanitizeJsonValue(trace), null, 2);
}

export function AdminPage() {
  const [providerStatus, setProviderStatus] =
    useState<AdminProviderStatus | null>(null);
  const [providerHealth, setProviderHealth] =
    useState<AdminProviderCheckResult | null>(null);
  const [providerTestResult, setProviderTestResult] =
    useState<AdminProviderTestGenerateResult | null>(null);
  const [modelCapabilities, setModelCapabilities] = useState<
    AdminModelCapabilityRecord[]
  >([]);
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<ApiTask | null>(null);
  const [taskEvents, setTaskEvents] = useState<TaskEventRecord[]>([]);
  const [adminLogs, setAdminLogs] = useState<AdminLogRecord[]>([]);
  const [adminLogsTotal, setAdminLogsTotal] = useState<number | undefined>();
  const [logLevel, setLogLevel] = useState<AdminLogFilterLevel>("DEBUG");
  const [logSearch, setLogSearch] = useState("");
  const [logLimit, setLogLimit] = useState(50);
  const [lastLogRefreshAt, setLastLogRefreshAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProviderLoading, setIsProviderLoading] = useState(true);
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const [isProviderChecking, setIsProviderChecking] = useState(false);
  const [isProviderTesting, setIsProviderTesting] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerAlertError, setProviderAlertError] = useState<string | null>(null);
  const [providerTestError, setProviderTestError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modelActionId, setModelActionId] = useState<string | null>(null);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [acknowledgingAlertId, setAcknowledgingAlertId] = useState<string | null>(null);
  const taskDetailRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setIsLoading(true);
      setIsProviderLoading(true);
      setIsLogsLoading(true);
      setPageError(null);
      setProviderError(null);
      setLogsError(null);

      const providerStatusRequest = apiClient
        .getAdminProvider()
        .then((provider) => ({ provider }))
        .catch((error: unknown) => ({ error }));
      const logsRequest = apiClient
        .listAdminLogs({
          level: logLevel,
          search: logSearch,
          limit: logLimit,
        })
        .then((response) => ({ response }))
        .catch((error: unknown) => ({ error }));

      try {
        const [capabilityList, taskList] = await Promise.all([
          apiClient.listAdminModelCapabilities(),
          apiClient.listTasks(),
        ]);
        if (ignore) {
          return;
        }

        setModelCapabilities(capabilityList);
        setTasks(taskList);

        const nextTaskId = taskList[0]?.id ?? null;
        setSelectedTaskId(nextTaskId);

        if (nextTaskId) {
          setIsDetailLoading(true);
          const detail = await fetchTaskDetail(nextTaskId);
          if (!ignore) {
            setSelectedTask(detail.task);
            setTaskEvents(detail.events);
          }
        }
      } catch (requestError: unknown) {
        if (!ignore) {
          setPageError(`${getSafeErrorMessage(requestError)} (API: ${apiClient.getBaseUrl()})`);
          setModelCapabilities([]);
          setTasks([]);
          setSelectedTask(null);
          setTaskEvents([]);
        }
      } finally {
        const providerResult = await providerStatusRequest;
        const logsResult = await logsRequest;
        if (!ignore) {
          if ("provider" in providerResult) {
            setProviderStatus(providerResult.provider);
          } else {
            setProviderStatus(null);
            setProviderError(
              `${getSafeErrorMessage(providerResult.error)} (API: ${apiClient.getBaseUrl()})`,
            );
          }

          if ("response" in logsResult) {
            setAdminLogs(logsResult.response.logs);
            setAdminLogsTotal(logsResult.response.total);
            setLastLogRefreshAt(new Date().toISOString());
          } else {
            setAdminLogs([]);
            setAdminLogsTotal(undefined);
            setLogsError(
              `${getSafeErrorMessage(logsResult.error)} (API: ${apiClient.getBaseUrl()})`,
            );
          }
        }

        if (!ignore) {
          setIsLoading(false);
          setIsProviderLoading(false);
          setIsLogsLoading(false);
          setIsDetailLoading(false);
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, []);

  async function refreshTasks(nextSelectedId = selectedTaskId) {
    const taskList = await apiClient.listTasks();
    setTasks(taskList);

    const resolvedTaskId =
      nextSelectedId && taskList.some((task) => task.id === nextSelectedId)
        ? nextSelectedId
        : taskList[0]?.id ?? null;
    setSelectedTaskId(resolvedTaskId);

    if (resolvedTaskId) {
      const detail = await fetchTaskDetail(resolvedTaskId);
      setSelectedTask(detail.task);
      setTaskEvents(detail.events);
    } else {
      setSelectedTask(null);
      setTaskEvents([]);
    }
  }

  async function refreshProviderStatus() {
    setIsProviderLoading(true);
    setProviderError(null);

    try {
      const provider = await apiClient.getAdminProvider();
      setProviderStatus(provider);
    } catch (requestError: unknown) {
      setProviderStatus(null);
      setProviderError(`${getSafeErrorMessage(requestError)} (API: ${apiClient.getBaseUrl()})`);
    } finally {
      setIsProviderLoading(false);
    }
  }

  async function refreshAdminLogs(
    options: {
      level?: AdminLogFilterLevel;
      search?: string;
      limit?: number;
    } = {},
  ) {
    const nextLevel = options.level ?? logLevel;
    const nextSearch = options.search ?? logSearch;
    const nextLimit = options.limit ?? logLimit;

    setIsLogsLoading(true);
    setLogsError(null);

    try {
      const response: AdminLogsResponse = await apiClient.listAdminLogs({
        level: nextLevel,
        search: nextSearch,
        limit: nextLimit,
      });
      setAdminLogs(response.logs);
      setAdminLogsTotal(response.total);
      setLastLogRefreshAt(new Date().toISOString());
    } catch (requestError: unknown) {
      setAdminLogs([]);
      setAdminLogsTotal(undefined);
      setLogsError(`${getSafeErrorMessage(requestError)} (API: ${apiClient.getBaseUrl()})`);
    } finally {
      setIsLogsLoading(false);
    }
  }

  function scrollTaskDetailIntoView() {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      taskDetailRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  async function checkProviderHealth() {
    setIsProviderChecking(true);
    setProviderError(null);
    setProviderHealth(null);

    try {
      const result = await apiClient.checkAdminProvider();
      setProviderHealth(result);
      if (result.provider) {
        setProviderStatus(result.provider);
      }
      await refreshProviderStatus();
    } catch (requestError: unknown) {
      setProviderHealth({
        ok: false,
        status: "unhealthy",
        errorSummary: getSafeErrorMessage(requestError),
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setIsProviderChecking(false);
    }
  }

  async function testGenerateProvider() {
    if (!providerStatus) {
      return;
    }

    const isRealMode = providerStatus.mode === "real";
    const confirmed = window.confirm(
      `Run a provider test generation for ${getProviderLabel(providerStatus)}? ${
        isRealMode
          ? "This may call the real upstream provider and incur cost."
          : "This runs against the configured provider mode."
      }`,
    );
    if (!confirmed) {
      return;
    }

    setIsProviderTesting(true);
    setProviderTestError(null);
    setProviderTestResult(null);
    setNotice(null);

    try {
      const result = await apiClient.testGenerateAdminProvider();
      setProviderTestResult(result);

      const taskId = getTestTaskId(result);
      if (taskId) {
        await refreshTasks(taskId);
        setNotice(`Provider test queued as task ${taskId}.`);
      } else {
        setNotice("Provider test completed without creating a tracked task.");
      }
      await refreshProviderStatus();
    } catch (requestError: unknown) {
      setProviderTestError(getSafeErrorMessage(requestError));
    } finally {
      setIsProviderTesting(false);
    }
  }

  async function openTaskDetail(
    id: string,
    options: {
      setAlertError?: boolean;
    } = {},
  ) {
    setSelectedTaskId(id);
    setDetailError(null);
    if (options.setAlertError) {
      setProviderAlertError(null);
    }
    setIsDetailLoading(true);

    try {
      const detail = await fetchTaskDetail(id);
      setSelectedTask(detail.task);
      setTaskEvents(detail.events);
      setTasks((current) => mergeTaskIntoList(current, detail.task));
      scrollTaskDetailIntoView();
    } catch (requestError: unknown) {
      const message = getSafeErrorMessage(requestError);
      setDetailError(message);
      if (options.setAlertError) {
        setProviderAlertError(message);
      }
      setSelectedTask(null);
      setTaskEvents([]);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function selectTask(id: string) {
    if (id === selectedTaskId) {
      scrollTaskDetailIntoView();
      return;
    }

    setSelectedTaskId(id);
    setDetailError(null);
    setIsDetailLoading(true);

    try {
      const detail = await fetchTaskDetail(id);
      setSelectedTask(detail.task);
      setTaskEvents(detail.events);
    } catch (requestError: unknown) {
      setDetailError(getSafeErrorMessage(requestError));
      setSelectedTask(null);
      setTaskEvents([]);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function acknowledgeProviderAlert(alert: AdminProviderAlert) {
    setAcknowledgingAlertId(alert.id);
    setProviderAlertError(null);

    try {
      await apiClient.acknowledgeAdminProviderAlert(alert.id);
      await refreshProviderStatus();
    } catch (requestError: unknown) {
      setProviderAlertError(getSafeErrorMessage(requestError));
    } finally {
      setAcknowledgingAlertId(null);
    }
  }

  async function retryTask(task: ApiTask) {
    if (task.status !== "failed") {
      setDetailError(`Only failed tasks can be retried. Current status: ${task.status}.`);
      return;
    }

    const confirmed = window.confirm(
      `Create a new retry task from failed task ${task.id}?`,
    );
    if (!confirmed) {
      return;
    }

    setRetryingTaskId(task.id);
    setDetailError(null);
    setNotice(null);

    try {
      const newTask = await apiClient.retryTask(task.id);
      await refreshTasks(newTask.id);
      setNotice(`Retry queued as task ${newTask.id}.`);
    } catch (requestError: unknown) {
      setDetailError(getSafeErrorMessage(requestError));
    } finally {
      setRetryingTaskId(null);
    }
  }

  async function toggleModelCapability(
    item: AdminModelCapabilityRecord,
    enabled: boolean,
  ) {
    if (item.enabled === enabled) {
      return;
    }

    const confirmed = window.confirm(
      `${enabled ? "Enable" : "Disable"} ${item.name || item.model}?`,
    );
    if (!confirmed) {
      return;
    }

    setModelActionId(item.id);
    setPageError(null);
    setNotice(null);

    try {
      const updated = await apiClient.updateAdminModelCapability(item.id, {
        enabled,
      });
      setModelCapabilities((current) =>
        current.map((model) => (model.id === updated.id ? updated : model)),
      );
      void refreshProviderStatus();
      setNotice(`${updated.name || updated.model} is now ${updated.enabled ? "enabled" : "disabled"}.`);
    } catch (requestError: unknown) {
      setPageError(getSafeErrorMessage(requestError));
    } finally {
      setModelActionId(null);
    }
  }

  const latestHealth = providerHealth ?? providerStatus?.lastCheck ?? null;
  const latestTestResult = providerTestResult ?? providerStatus?.lastTest ?? null;
  const testTaskId = getTestTaskId(latestTestResult);
  const providerAlerts = (providerStatus?.alerts ?? []).filter(isProviderAlertActive);
  const providerAlertSummary = getProviderAlertSummary(providerStatus);
  const providerAvailabilityItems = providerStatus
    ? getProviderModelAvailabilityItems(providerStatus, modelCapabilities)
    : [];
  const lastLog = adminLogs[0];
  const overviewProviderStatus = providerStatus
    ? latestHealth
      ? latestHealth.ok
        ? "healthy"
        : "attention"
      : providerStatus.mode
    : isProviderLoading
      ? "loading"
      : "unavailable";
  const overviewLogStatus = isLogsLoading
    ? "refreshing"
    : logsError
      ? "error"
      : lastLogRefreshAt
        ? `updated ${formatRelativeTime(lastLogRefreshAt)}`
        : "not loaded";
  const providerWarningTexts = providerStatus
    ? [
        ...(providerStatus.warnings ?? []).map(getProviderWarningText),
        ...(!providerStatus.apiKeyConfigured && providerStatus.mode !== "mock"
          ? ["Provider API key is missing; real upstream calls are disabled."]
          : []),
        ...(latestHealth && !latestHealth.ok
          ? [`Latest health check failed: ${getHealthSummary(latestHealth) ?? "No summary."}`]
          : []),
        ...(latestTestResult && latestTestResult.ok === false
          ? [
              `Latest test generation failed: ${
                getTestFailureSummary(latestTestResult) ??
                (latestTestResult.message
                  ? sanitizeSensitiveText(latestTestResult.message)
                  : undefined) ??
                "No summary."
              }`,
            ]
          : []),
      ]
    : [];
  const canRunProviderTest =
    Boolean(providerStatus) &&
    !isProviderLoading &&
    !isProviderTesting &&
    (providerStatus?.mode === "mock" || Boolean(providerStatus?.apiKeyConfigured));

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Admin overview / 运维总览</CardTitle>
          <CardDescription>
            Provider readiness, workload, alert pressure, and DEBUG log visibility.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoItem label="Provider" value={overviewProviderStatus} />
            <InfoItem label="Tasks" value={isLoading ? "loading" : tasks.length} />
            <InfoItem
              label="Active Alerts"
              value={isProviderLoading ? "loading" : providerAlertSummary.activeCount}
            />
            <InfoItem
              label="Logs / Refresh"
              value={`${adminLogsTotal ?? adminLogs.length} / ${overviewLogStatus}`}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">log level {logLevel}</Badge>
            {lastLog ? (
              <span className="break-all">
                latest {lastLog.level} from {lastLog.context} at{" "}
                {formatTimestamp(lastLog.timestamp)}
              </span>
            ) : (
              <span>No logs loaded yet.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Provider Status / Health</CardTitle>
              <CardDescription>
                Single upstream provider for this release. No marketplace or tenant switching.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isProviderLoading}
              onClick={() => void refreshProviderStatus()}
            >
              {isProviderLoading ? "Refreshing..." : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isProviderLoading ? (
              <div className={cn(surfacePanelClass, "p-4 text-sm text-muted-foreground")}>
                Loading provider status...
              </div>
            ) : null}
            {providerError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {providerError}
              </div>
            ) : null}
            {!isProviderLoading && !providerError && !providerStatus ? (
              <div className={cn(surfacePanelClass, "p-4 text-sm text-muted-foreground")}>
                Provider status is unavailable.
              </div>
            ) : null}

            {providerStatus ? (
              <>
                <div className={cn(surfacePanelClass, "p-4")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{providerStatus.name || "Provider"}</Badge>
                    <Badge variant="outline">{providerStatus.type || "unknown"}</Badge>
                    <Badge variant={providerStatus.mode === "real" ? "default" : "secondary"}>
                      {providerStatus.mode}
                    </Badge>
                    <Badge variant={providerStatus.apiKeyConfigured ? "default" : "outline"}>
                      {providerStatus.apiKeyConfigured ? "key configured" : "key missing"}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <InfoItem
                      label="Base URL"
                      value={
                        providerStatus.baseUrl
                          ? sanitizeSensitiveText(providerStatus.baseUrl)
                          : "-"
                      }
                    />
                    <InfoItem
                      label="Masked API Key"
                      value={
                        providerStatus.apiKeyConfigured
                          ? sanitizeSensitiveText(
                              providerStatus.maskedApiKey ||
                                "Configured (masked by server)",
                            )
                          : "Not configured"
                      }
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InfoItem
                        label="Default Generate"
                        value={providerStatus.defaultGenerateModel}
                      />
                      <InfoItem
                        label="Default Edit"
                        value={providerStatus.defaultEditModel}
                      />
                    </div>
                  </div>
                </div>

                {providerWarningTexts.length > 0 ? (
                  <div
                    className={cn(
                      "rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm",
                      warningTextClass,
                    )}
                  >
                    <div className="mb-2 font-medium">Provider warnings</div>
                    <ul className="space-y-1">
                      {[...new Set(providerWarningTexts)].map((warning) => (
                        <li key={warning}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className={cn(surfacePanelClass, "p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium">Alerts</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Active provider alerts with single-item acknowledgement.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {providerAlertSummary.activeCount === 0 ? (
                        <Badge
                          className={cn(
                            "border-emerald-400/30 bg-emerald-400/10",
                            successTextClass,
                          )}
                          variant="outline"
                        >
                          healthy / clear
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {providerAlertSummary.activeCount} active
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <InfoItem
                      label="Active Alerts"
                      value={providerAlertSummary.activeCount}
                    />
                    <InfoItem
                      label="Critical"
                      value={providerAlertSummary.criticalCount}
                    />
                    <InfoItem
                      label="Warning"
                      value={providerAlertSummary.warningCount}
                    />
                  </div>
                  {providerAlertError ? (
                    <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {providerAlertError}
                    </div>
                  ) : null}
                  {providerAlerts.length === 0 ? (
                    <div
                      className={cn(
                        "mt-4 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm",
                        successTextClass,
                      )}
                    >
                      No active alerts. Provider state is clear.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {providerAlerts.map((alert) => {
                        const severity = getProviderAlertSeverity(alert);
                        const title = getProviderAlertTitle(alert);
                        const message = getProviderAlertMessage(alert);
                        const timestamp = getProviderAlertTimestamp(alert);
                        const taskId = getProviderAlertTaskId(alert);

                        return (
                          <div
                            key={alert.id}
                            className={cn(
                              "rounded-lg border p-3",
                              getProviderAlertCardClass(severity),
                            )}
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className={getProviderAlertBadgeClass(severity)}
                                  >
                                    {severity}
                                  </Badge>
                                  <p className="break-all text-sm font-medium">{title}</p>
                                </div>
                                {message && message !== title ? (
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    {message}
                                  </p>
                                ) : null}
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{formatTimestamp(timestamp)}</span>
                                  {timestamp ? (
                                    <span>({formatRelativeTime(timestamp)})</span>
                                  ) : null}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={acknowledgingAlertId === alert.id}
                                onClick={() => void acknowledgeProviderAlert(alert)}
                              >
                                {acknowledgingAlertId === alert.id
                                  ? "Acknowledging..."
                                  : "Acknowledge"}
                              </Button>
                            </div>
                            {taskId ? (
                              <div
                                className={cn(
                                  surfaceInsetClass,
                                  "mt-3 flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between",
                                )}
                              >
                                <div className="min-w-0">
                                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                    Related Task
                                  </p>
                                  <p className="mt-1 break-all text-sm">{taskId}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {selectedTaskId === taskId ? (
                                    <Badge variant="secondary">selected</Badge>
                                  ) : null}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      void openTaskDetail(taskId, {
                                        setAlertError: true,
                                      })
                                    }
                                  >
                                    Open task detail
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className={cn(surfacePanelClass, "p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium">Model Availability</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Enabled models only. Availability is informational, not a config editor.
                      </p>
                    </div>
                    <Badge variant="outline">{providerAvailabilityItems.length} enabled</Badge>
                  </div>
                  {providerAvailabilityItems.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {providerAvailabilityItems.map((item) => (
                        <div
                          key={item.key}
                          className={cn(surfaceInsetClass, "p-3")}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="break-all text-sm font-medium">{item.name}</p>
                              <p className="mt-1 break-all text-xs text-muted-foreground">
                                {item.model}
                              </p>
                            </div>
                            <Badge
                              variant={item.status === "available" ? "default" : "outline"}
                              className={getAvailabilityBadgeClass(item.status)}
                            >
                              {item.status}
                            </Badge>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {item.message}
                          </p>
                          {item.capabilityTypes.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {item.capabilityTypes.map((capability) => (
                                <Badge key={capability} variant="outline">
                                  {capability}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No enabled models to check.
                    </p>
                  )}
                </div>

                <div className={cn(surfacePanelClass, "p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium">Health Check</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Runs a sanitized provider connectivity check.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isProviderChecking || isProviderLoading}
                      onClick={() => void checkProviderHealth()}
                    >
                      {isProviderChecking ? "Checking..." : "Check health"}
                    </Button>
                  </div>
                  {latestHealth ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={getHealthBadgeVariant(latestHealth)}>
                          {latestHealth.ok ? "healthy" : "unhealthy"}
                        </Badge>
                        <Badge variant="outline">
                          {getHealthStatusLabel(latestHealth)}
                        </Badge>
                        {typeof latestHealth.latencyMs === "number" ? (
                          <Badge variant="outline">{latestHealth.latencyMs}ms</Badge>
                        ) : null}
                        {providerHealth ? (
                          <Badge variant="secondary">just checked</Badge>
                        ) : null}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <InfoItem
                          label="Checked At"
                          value={formatTimestamp(latestHealth.checkedAt)}
                        />
                        <InfoItem
                          label="Latency"
                          value={
                            typeof latestHealth.latencyMs === "number"
                              ? `${latestHealth.latencyMs}ms`
                              : "-"
                          }
                        />
                      </div>
                      {getHealthSummary(latestHealth) ? (
                        <div
                          className={cn(
                            surfaceInsetClass,
                            "p-3 text-sm text-muted-foreground",
                          )}
                        >
                          {getHealthSummary(latestHealth)}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No health check has been recorded yet.
                    </p>
                  )}
                </div>

                <div className={cn(surfacePanelClass, "p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-medium">Test Generation</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Confirms before creating a real provider test request.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      disabled={!canRunProviderTest}
                      onClick={() => void testGenerateProvider()}
                    >
                      {isProviderTesting ? "Testing..." : "Run test"}
                    </Button>
                  </div>
                  {!providerStatus.apiKeyConfigured && providerStatus.mode !== "mock" ? (
                    <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      Configure a provider API key before running a real test.
                    </div>
                  ) : null}
                  {providerTestError ? (
                    <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                      {providerTestError}
                    </div>
                  ) : null}
                  {latestTestResult ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={testTaskId ? "default" : "secondary"}>
                          {testTaskId ? "task created" : "direct result"}
                        </Badge>
                        {latestTestResult.status ? (
                          <Badge variant="outline">{latestTestResult.status}</Badge>
                        ) : null}
                        {latestTestResult.ok !== undefined ? (
                          <Badge variant={latestTestResult.ok ? "default" : "outline"}>
                            {latestTestResult.ok ? "ok" : "failed"}
                          </Badge>
                        ) : null}
                        {providerTestResult ? (
                          <Badge variant="secondary">just run</Badge>
                        ) : null}
                      </div>
                      <InfoItem
                        label="Last Test Time"
                        value={formatTimestamp(getTestTimestamp(latestTestResult))}
                      />
                      {testTaskId ? (
                        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                          <p className="break-all text-primary">Task ID: {testTaskId}</p>
                          <Button
                            className="mt-3"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              void openTaskDetail(testTaskId).catch((requestError: unknown) =>
                                setProviderTestError(getSafeErrorMessage(requestError)),
                              )
                            }
                          >
                            Open task detail
                          </Button>
                        </div>
                      ) : (
                        <div>{renderJson(latestTestResult.result ?? latestTestResult)}</div>
                      )}
                      {getTestFailureSummary(latestTestResult) ? (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          {getTestFailureSummary(latestTestResult)}
                        </div>
                      ) : null}
                      {latestTestResult.message ? (
                        <p className="text-sm text-muted-foreground">
                          {sanitizeSensitiveText(latestTestResult.message)}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-muted-foreground">
                      No test generation has been recorded yet.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Model Capabilities</CardTitle>
            <CardDescription>
              Lightweight switches for models exposed by the configured provider.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className={cn(surfacePanelClass, "p-4 text-sm text-muted-foreground")}>
                Loading model capabilities...
              </div>
            ) : null}
            {pageError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {pageError}
              </div>
            ) : null}
            {notice ? (
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary">
                {notice}
              </div>
            ) : null}
            {!isLoading && !pageError && modelCapabilities.length === 0 ? (
              <div className={cn(surfacePanelClass, "p-4 text-sm text-muted-foreground")}>
                No model capabilities found.
              </div>
            ) : null}
            {modelCapabilities.map((item) => (
              <div
                key={item.id}
                className={cn(surfacePanelClass, "px-4 py-3")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{item.name || item.model}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.provider} / {item.model} / {item.modality}
                    </p>
                  </div>
                  <Switch
                    checked={item.enabled}
                    disabled={modelActionId === item.id || isLoading}
                    onCheckedChange={(enabled) =>
                      void toggleModelCapability(item, enabled)
                    }
                  />
                </div>
                {item.description ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.capabilityTypes.map((capability) => (
                    <Badge key={capability} variant="outline">
                      {capability}
                    </Badge>
                  ))}
                  <Badge variant={item.enabled ? "default" : "outline"}>
                    {item.enabled ? "enabled" : "disabled"}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>Recent Tasks</CardTitle>
              <CardDescription>Latest 50 tasks for diagnostics.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={() =>
                void refreshTasks().catch((requestError: unknown) =>
                  setPageError(getSafeErrorMessage(requestError)),
                )
              }
            >
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      Loading tasks...
                    </TableCell>
                  </TableRow>
                ) : null}
                {!isLoading && tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No tasks found.
                    </TableCell>
                  </TableRow>
                ) : null}
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    className={
                      selectedTaskId === task.id ? selectedSurfaceClass : undefined
                    }
                    onClick={() => void selectTask(task.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        void selectTask(task.id);
                      }
                    }}
                  >
                    <TableCell>
                      <p className="font-medium">{shortId(task.id)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {task.capability} / {task.modelId}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={task.status === "failed" ? "outline" : "secondary"}>
                        {task.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatRelativeTime(task.updatedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </div>

        <div className="space-y-4">
      <Card ref={taskDetailRef}>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Troubleshooting Detail</CardTitle>
            <CardDescription>
              Sanitized task inputs, outputs, error context, and event log.
            </CardDescription>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={
              !selectedTask ||
              selectedTask.status !== "failed" ||
              retryingTaskId === selectedTask.id
            }
            onClick={() => selectedTask && void retryTask(selectedTask)}
          >
            {retryingTaskId === selectedTask?.id ? "Retrying..." : "Retry failed task"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {detailError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {detailError}
            </div>
          ) : null}
          {isDetailLoading ? (
            <div className={cn(surfacePanelClass, "p-4 text-sm text-muted-foreground")}>
              Loading task detail...
            </div>
          ) : null}
          {!isDetailLoading && !selectedTask ? (
            <div className={cn(surfacePanelClass, "p-6 text-sm text-muted-foreground")}>
              Select a task to inspect diagnostics.
            </div>
          ) : null}
          {selectedTask ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{selectedTask.status}</Badge>
                <Badge variant="outline">{selectedTask.capability}</Badge>
                <Badge variant="outline">{selectedTask.modelId}</Badge>
                <Badge variant="outline">progress {selectedTask.progress ?? 0}%</Badge>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <InfoItem label="Task ID" value={selectedTask.id} />
                <InfoItem
                  label="Conversation"
                  value={
                    selectedTask.conversationTitle
                      ? `${selectedTask.conversationTitle} (${shortId(selectedTask.conversationId)})`
                      : selectedTask.conversationId
                  }
                />
                <InfoItem
                  label="User"
                  value={
                    selectedTask.userEmail ||
                    selectedTask.userDisplayName ||
                    selectedTask.userId
                  }
                />
                <InfoItem label="Created" value={formatTimestamp(selectedTask.createdAt)} />
                <InfoItem label="Updated" value={formatTimestamp(selectedTask.updatedAt)} />
                <InfoItem
                  label="Assets"
                  value={selectedTask.assetIds?.length ? selectedTask.assetIds.join(", ") : "-"}
                />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="space-y-2">
                  <h4 className="text-sm font-medium">Input Summary</h4>
                  {renderJson(selectedTask.inputSummary)}
                </section>
                <section className="space-y-2">
                  <h4 className="text-sm font-medium">Output Summary</h4>
                  {renderJson(selectedTask.outputSummary)}
                </section>
              </div>

              {selectedTask.errorMessage ? (
                <section className="space-y-2">
                  <h4 className="text-sm font-medium">Error</h4>
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                    {sanitizeSensitiveText(selectedTask.errorMessage)}
                  </div>
                </section>
              ) : null}

              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium">Task Events</h4>
                  <span className="text-xs text-muted-foreground">
                    {taskEvents.length} events
                  </span>
                </div>
                {taskEvents.length === 0 ? (
                  <div className={cn(surfacePanelClass, "p-4 text-sm text-muted-foreground")}>
                    No events recorded yet.
                  </div>
                ) : null}
                <div className="space-y-3">
                  {taskEvents.map((event) => (
                    <div
                      key={event.id}
                      className={cn(surfacePanelClass, "p-4")}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{event.eventType}</Badge>
                        {event.status ? (
                          <Badge variant="secondary">{event.status}</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(event.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm">{event.summary}</p>
                      {event.details && Object.keys(event.details).length > 0 ? (
                        <div className="mt-3">{renderJson(event.details)}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </CardContent>
      </Card>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle>系统日志 / DEBUG</CardTitle>
                <CardDescription>
                  Filtered admin logs from /api/admin/logs. Messages stay compact and copy friendly.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={isLogsLoading}
                onClick={() => void refreshAdminLogs()}
              >
                {isLogsLoading ? "Refreshing..." : "Refresh logs"}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[140px_minmax(0,1fr)_120px_auto]">
                <label className="space-y-1 text-sm">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Level
                  </span>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-[hsl(var(--surface-container-low)/0.78)] px-3 py-2 text-sm text-foreground shadow-[var(--input-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={logLevel}
                    onChange={(event) => {
                      const nextLevel = event.target.value as AdminLogFilterLevel;
                      setLogLevel(nextLevel);
                      void refreshAdminLogs({ level: nextLevel });
                    }}
                  >
                    {(["DEBUG", "INFO", "WARN", "ERROR", "ALL"] as const).map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Search
                  </span>
                  <Input
                    value={logSearch}
                    placeholder="context, message, trace"
                    onChange={(event) => setLogSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void refreshAdminLogs();
                      }
                    }}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Limit
                  </span>
                  <Input
                    min={1}
                    max={500}
                    type="number"
                    value={logLimit}
                    onChange={(event) => {
                      const nextLimit = Number(event.target.value);
                      if (Number.isFinite(nextLimit)) {
                        setLogLimit(nextLimit);
                      }
                    }}
                  />
                </label>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={isLogsLoading}
                    onClick={() => void refreshAdminLogs()}
                  >
                    Apply
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{adminLogsTotal ?? adminLogs.length} logs</Badge>
                <Badge variant="outline">{overviewLogStatus}</Badge>
                {logsError ? (
                  <span className="break-all text-destructive">{logsError}</span>
                ) : null}
              </div>

              {isLogsLoading ? (
                <div className={cn(surfacePanelClass, "p-4 text-sm text-muted-foreground")}>
                  Loading logs...
                </div>
              ) : null}
              {!isLogsLoading && !logsError && adminLogs.length === 0 ? (
                <div className={cn(surfacePanelClass, "p-4 text-sm text-muted-foreground")}>
                  No logs returned for the current filter.
                </div>
              ) : null}
              <div className="space-y-2">
                {adminLogs.map((log) => {
                  const trace = formatLogTrace(log.trace);

                  return (
                    <div
                      key={log.id}
                      className={cn(surfacePanelClass, "p-3")}
                    >
                      <div className="grid gap-2 lg:grid-cols-[180px_90px_160px_minmax(0,1fr)] lg:items-start">
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <Badge
                          variant="outline"
                          className={getLogLevelBadgeClass(log.level)}
                        >
                          {log.level}
                        </Badge>
                        <code
                          className={cn(
                            "min-w-0 break-all rounded px-2 py-1 text-xs text-muted-foreground",
                            "bg-[hsl(var(--surface-container-lowest)/0.86)]",
                          )}
                        >
                          {sanitizeSensitiveText(log.context)}
                        </code>
                        <pre
                          className={cn(
                            "min-w-0 whitespace-pre-wrap break-words rounded px-2 py-1 text-xs leading-relaxed text-foreground",
                            "bg-[hsl(var(--surface-container-low)/0.84)]",
                          )}
                        >
                          {sanitizeSensitiveText(log.message)}
                        </pre>
                      </div>
                      {trace ? (
                        <details className={cn(surfaceInsetClass, "mt-2 p-2")}>
                          <summary className="cursor-pointer text-xs text-muted-foreground">
                            trace
                          </summary>
                          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground">
                            {trace}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className={cn(surfaceInsetClass, "rounded-xl p-3")}>
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 break-all text-sm">{value ?? "-"}</p>
    </div>
  );
}
