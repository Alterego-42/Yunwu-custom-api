import { MessageSquarePlus, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
}: {
  sessions: ConversationSummary[];
  activeId?: string;
  isLoading?: boolean;
  error?: string | null;
  onCreate: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-border/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">会话</p>
            <p className="text-xs text-muted-foreground">最近任务与上下文</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onCreate} disabled={isLoading}>
            <MessageSquarePlus className="h-4 w-4" />
            新建
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="搜索会话 / 任务 ID" />
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {isLoading ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
              正在加载会话...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {!isLoading && !error && sessions.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
              暂无会话。点击“新建”创建第一个真实会话。
            </div>
          ) : null}

          {sessions.map((session) => {
            const status = getConversationStatus(session);

            return (
              <button
                key={session.id}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition-colors",
                  activeId === session.id
                    ? "border-primary/40 bg-primary/10"
                    : "border-white/5 bg-white/[0.03] hover:bg-white/[0.05]",
                )}
                type="button"
                onClick={() => onSelect(session.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-foreground">{session.title || "未命名会话"}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {getConversationSummary(session)}
                    </p>
                  </div>
                  <Badge variant={activeId === session.id ? "default" : "outline"}>
                    {statusMap[status]}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatRelativeTime(session.updatedAt)}</span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    {getConversationModel(session)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
