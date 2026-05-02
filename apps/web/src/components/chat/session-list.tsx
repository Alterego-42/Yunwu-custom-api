import { useMemo, useState } from "react";
import {
  Archive,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatRelativeTime,
  getConversationModel,
  getConversationStatus,
  getConversationSummary,
} from "@/lib/api-mappers";
import type { ConversationSummary } from "@/lib/api-types";
import { cn } from "@/lib/utils";

const statusMap: Record<ReturnType<typeof getConversationStatus>, string> = {
  idle: "待处理",
  running: "进行中",
  done: "已完成",
};

export function SessionList({
  sessions,
  activeId,
  isLoading,
  error,
  onCreate,
  onSelect,
  onArchive,
  onDelete,
  isCollapsed = false,
  onToggleCollapse,
}: {
  sessions: ConversationSummary[];
  activeId?: string;
  isLoading?: boolean;
  error?: string | null;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onArchive?: (id: string) => void;
  onDelete?: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const visibleSessions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return sessions;
    }

    return sessions.filter((session) => {
      const searchable = [
        session.title,
        getConversationSummary(session),
        getConversationModel(session),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [searchQuery, sessions]);

  if (isCollapsed) {
    return (
      <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" data-testid="session-list-collapsed">
        <div className="flex flex-col items-center gap-2 border-b border-border/70 p-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="展开会话栏"
            onClick={onToggleCollapse}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
          <Button
            className="h-8 w-8"
            size="icon"
            variant="secondary"
            aria-label="发起会话"
            onClick={onCreate}
            disabled={isLoading}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-2">
            {visibleSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={cn(
                  "relative flex h-10 w-full items-center justify-center rounded-xl border text-xs font-semibold transition-colors",
                  activeId === session.id
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-[hsl(var(--outline-variant)/0.65)] bg-[hsl(var(--surface-container-low)/0.8)] text-muted-foreground hover:bg-[hsl(var(--surface-container)/0.9)] hover:text-foreground",
                )}
                aria-label={`选择会话 ${session.title || "未命名会话"}`}
                title={session.title || "未命名会话"}
                onClick={() => onSelect(session.id)}
              >
                <span className="max-w-8 truncate">
                  {(session.title || "未命名").slice(0, 2)}
                </span>
                {getConversationStatus(session) === "running" ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-300" />
                ) : null}
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>
    );
  }

  return (
    <Card className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden" data-testid="session-list">
      <div className="border-b border-border/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">工作台</p>
            <p className="truncate text-xs text-muted-foreground">最近会话与上下文</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label="收起会话栏"
              onClick={onToggleCollapse}
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
            <Button className="shrink-0" size="sm" variant="secondary" onClick={onCreate} disabled={isLoading}>
              <MessageSquarePlus className="h-4 w-4" />
              发起
            </Button>
          </div>
        </div>
        <label className="mt-3 flex h-8 items-center gap-2 rounded-lg border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.86)] px-2 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            aria-label="搜索会话"
            className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            placeholder="搜索标题、摘要或模型"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!error && !isLoading && visibleSessions.length === 0 ? (
            <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.7)] bg-[hsl(var(--surface-container)/0.88)] p-4 text-sm text-muted-foreground">
              {sessions.length === 0 ? "暂无工作台。先发起一次创作。" : "没有匹配的会话。"}
            </div>
          ) : null}

          {visibleSessions.map((session) => {
            const status = getConversationStatus(session);

            return (
              <div
                key={session.id}
                className={cn(
                  "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 overflow-hidden rounded-xl border p-3 transition-colors",
                  activeId === session.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-[hsl(var(--outline-variant)/0.65)] bg-[hsl(var(--surface-container-low)/0.8)] hover:bg-[hsl(var(--surface-container)/0.9)]",
                )}
              >
                <button
                  className="min-w-0 overflow-hidden text-left"
                  type="button"
                  onClick={() => onSelect(session.id)}
                >
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                    <div className="min-w-0 overflow-hidden">
                      <p className="line-clamp-2 break-words font-medium leading-5 text-foreground">
                        {session.title || "未命名会话"}
                      </p>
                      <p className="mt-2 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">
                        {getConversationSummary(session)}
                      </p>
                    </div>
                    <Badge
                      className="max-w-20 shrink-0 whitespace-nowrap"
                      variant={activeId === session.id ? "default" : "outline"}
                    >
                      {statusMap[status]}
                    </Badge>
                  </div>
                  <div className="mt-3 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 text-xs text-muted-foreground">
                    <span className="shrink-0 whitespace-nowrap">{formatRelativeTime(session.updatedAt)}</span>
                    <span className="inline-flex min-w-0 items-center justify-end gap-1 overflow-hidden">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{getConversationModel(session)}</span>
                    </span>
                  </div>
                </button>
                <div className="flex w-8 shrink-0 flex-col items-center gap-1" data-testid="session-card-actions">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    aria-label={`归档 ${session.title || "未命名会话"}`}
                    onClick={() => onArchive?.(session.id)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    aria-label={`删除 ${session.title || "未命名会话"}`}
                    onClick={() => onDelete?.(session.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
