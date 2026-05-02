import type { ReactNode } from "react";
import { Download, FolderGit2, Image as ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatRelativeTime,
  isLibraryItemDisplayable,
  resolveAssetUrl,
} from "@/lib/api-mappers";
import type { LibraryItemRecord } from "@/lib/api-types";

export function LibraryItemCard({
  item,
  actions,
  deleting = false,
}: {
  item: LibraryItemRecord;
  actions?: ReactNode;
  deleting?: boolean;
}) {
  if (!isLibraryItemDisplayable(item)) {
    return null;
  }

  const assetUrl = resolveAssetUrl(item.asset.url, item.asset.storageKey);

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container-lowest))]">
        {assetUrl ? (
          <img src={assetUrl} alt={item.task.prompt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{item.task.capability}</Badge>
            <Badge variant="outline">{item.task.modelId}</Badge>
            {item.task.sourceAction ? <Badge variant="outline">{item.task.sourceAction}</Badge> : null}
          </div>
          <h3 className="line-clamp-2 text-sm font-medium text-foreground">{item.task.prompt || "未命名作品"}</h3>
          <p className="text-xs text-muted-foreground">
            {item.conversation?.title ?? item.task.conversationTitle ?? "未命名会话"} · {formatRelativeTime(item.asset.createdAt)}
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <FolderGit2 className="h-3.5 w-3.5" />
            {item.task.id}
          </span>
          <span>{item.asset.width && item.asset.height ? `${item.asset.width} × ${item.asset.height}` : item.asset.mimeType ?? "image"}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {assetUrl ? (
            <Button variant="outline" size="sm" asChild>
              <a href={assetUrl} download rel="noreferrer">
                <Download className="h-4 w-4" />
                下载
              </a>
            </Button>
          ) : null}
          {actions}
          {deleting ? <Badge variant="outline">删除中...</Badge> : null}
        </div>
      </CardContent>
    </Card>
  );
}
