import { Download, Expand, Image as ImageIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { UiImageResult } from "@/lib/api-types";

export function ImageResultCard({ item }: { item: UiImageResult }) {
  return (
    <Card className="overflow-hidden border-white/10 bg-white/[0.03]">
      <div className="relative aspect-[4/3] overflow-hidden border-b border-border/60 bg-[linear-gradient(135deg,rgba(59,130,246,.25),rgba(15,23,42,.85),rgba(244,114,182,.18))]">
        {item.url ? (
          <img src={item.url} alt={item.prompt} className="h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0 bg-grid bg-[size:18px_18px] opacity-40" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="rounded-full border border-white/10 bg-black/20 p-3">
                <ImageIcon className="h-7 w-7 text-white/80" />
              </div>
              <Badge>{item.badge}</Badge>
            </div>
          </>
        )}
      </div>
      <CardContent className="space-y-4 p-4">
        <div>
          <p className="line-clamp-2 text-sm text-foreground">{item.prompt}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {item.model} · {item.size}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild={Boolean(item.url)}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer">
                <Expand className="h-4 w-4" />
                预览
              </a>
            ) : (
              <>
                <Expand className="h-4 w-4" />
                预览
              </>
            )}
          </Button>
          <Button variant="ghost" size="icon" asChild={Boolean(item.url)}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" aria-label="下载或打开图片">
                <Download className="h-4 w-4" />
              </a>
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
