import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Trash2 } from "lucide-react";

import { LibraryItemCard } from "@/components/cards/library-item-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import type { LibraryItemRecord, LibraryResponse } from "@/lib/api-types";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "请求失败，请稍后重试。";
}

export function LibraryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<LibraryResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await apiClient.getLibrary());
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const deletingSet = useMemo(() => new Set(deletingIds), [deletingIds]);

  const handleDelete = useCallback(async (item: LibraryItemRecord) => {
    setDeletingIds((current) => [...current, item.asset.id]);

    try {
      await apiClient.deleteLibraryAsset(item.asset.id);
      setData((current) =>
        current
          ? {
              items: current.items.filter((entry) => entry.asset.id !== item.asset.id),
            }
          : current,
      );
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setDeletingIds((current) => current.filter((id) => id !== item.asset.id));
    }
  }, []);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <CardTitle>作品库</CardTitle>
          </div>
          <CardDescription>仅展示成功作品；软删除只影响作品库和首页最近作品。</CardDescription>
        </CardHeader>
      </Card>

      {error ? (
        <Card className="border-destructive/30 bg-destructive/10">
          <CardContent className="p-5 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
            正在加载作品库...
          </div>
        ) : null}
        {!loading && !data?.items.length ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
            作品库为空，生成成功的作品会出现在这里。
          </div>
        ) : null}

        {data?.items.map((item) => (
          <LibraryItemCard
            key={item.asset.id}
            item={item}
            deleting={deletingSet.has(item.asset.id)}
            actions={
              <>
                {item.conversation?.id ? (
                  <Button size="sm" variant="outline" onClick={() => navigate(`/workspace/${item.conversation?.id}`)}>
                    查看来源
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => navigate(`/create?fromTaskId=${item.task.id}&mode=edit`)}>
                  继续创作
                </Button>
                <Button size="sm" onClick={() => navigate(`/create?fromTaskId=${item.task.id}&mode=variant&fork=1`)}>
                  Fork
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDelete(item)}
                  disabled={deletingSet.has(item.asset.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </Button>
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}
