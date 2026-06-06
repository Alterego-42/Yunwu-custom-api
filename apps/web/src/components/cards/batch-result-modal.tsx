import { useEffect, useState } from "react";
import { Download, ExternalLink, Image as ImageIcon, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveAssetUrl } from "@/lib/api-mappers";
import type { UiTask, UiTaskAsset } from "@/lib/api-types";

function BatchAssetLightbox({
  asset,
  assetUrl,
  onClose,
}: {
  asset: UiTaskAsset;
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

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`${asset.label} 预览`}
      onClick={onClose}
      data-testid="batch-asset-lightbox"
    >
      <div
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{asset.label}</p>
            <p className="text-xs text-muted-foreground">{asset.mimeType ?? asset.type}</p>
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
          <img src={assetUrl} alt={asset.label} className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain" />
        </div>
      </div>
    </div>
  );
}

export function BatchResultModal({
  task,
  open,
  onClose,
  onEditAsset,
}: {
  task: UiTask;
  open: boolean;
  onClose: () => void;
  onEditAsset?: (asset: UiTaskAsset) => void;
}) {
  const [previewAsset, setPreviewAsset] = useState<{
    asset: UiTaskAsset;
    url: string;
  } | null>(null);

  if (!open) {
    return null;
  }

  const slotsWithAssets = (task.batchSlots ?? [])
    .filter((slot) => slot.status === "succeeded" && slot.asset)
    .sort((left, right) => left.batchIndex - right.batchIndex);
  const successfulSlots =
    slotsWithAssets.length > 0
      ? slotsWithAssets
      : (task.resultAssets ?? []).map((asset, index) => ({
          id: `${task.id}-${asset.id}`,
          taskId: task.id,
          batchIndex: index,
          status: "succeeded" as const,
          progress: 100,
          asset,
          attempt: 1,
        }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="批量结果"
      onClick={onClose}
      data-testid="batch-result-modal"
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">批量结果</p>
            <p className="text-xs text-muted-foreground">
              成功 {task.batch?.successCount ?? successfulSlots.length} / 共 {task.batch?.batchSize ?? successfulSlots.length} 个
            </p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
            aria-label="关闭批量结果"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 overflow-auto p-4">
          {successfulSlots.length === 0 ? (
            <div className="rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)] p-4 text-sm text-muted-foreground">
              当前批量任务还没有成功图片。
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {successfulSlots.map((slot) => {
              const asset = slot.asset;
              if (!asset) {
                return null;
              }

              const assetUrl = resolveAssetUrl(asset.url, asset.storageKey);

              return (
                <div
                  key={slot.id}
                  className="overflow-hidden rounded-xl border border-[hsl(var(--outline-variant)/0.72)] bg-[hsl(var(--surface-container)/0.9)]"
                >
                  <div className="relative aspect-[4/3] bg-[hsl(var(--surface-container-lowest))]">
                    {assetUrl ? (
                      <button
                        type="button"
                        className="block h-full w-full"
                        aria-label={`预览批量结果 ${slot.batchIndex + 1}`}
                        onClick={() => setPreviewAsset({ asset, url: assetUrl })}
                      >
                        <img
                          src={assetUrl}
                          alt={`批量结果 ${slot.batchIndex + 1}`}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-medium text-foreground">#{slot.batchIndex + 1}</span>
                      <span className="text-muted-foreground">{asset.mimeType ?? asset.type}</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {onEditAsset ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onEditAsset(asset)}
                        >
                          <Pencil className="h-4 w-4" />
                          再编辑
                        </Button>
                      ) : null}
                      {assetUrl ? (
                        <>
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
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {previewAsset ? (
        <BatchAssetLightbox
          asset={previewAsset.asset}
          assetUrl={previewAsset.url}
          onClose={() => setPreviewAsset(null)}
        />
      ) : null}
    </div>
  );
}
