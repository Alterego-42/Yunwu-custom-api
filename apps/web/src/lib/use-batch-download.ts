import { useCallback, useState } from "react";

import { apiClient } from "@/lib/api-client";

/**
 * 批量下载作品库内容。
 *
 * 单张图与批量任务的多个结果是同一条路径：勾选时按资产 id 收集，
 * 由服务端打成 zip（文件名规则：日期 + 哈希前几位）。
 * 放在 hook 里是为了让作品库工具栏和批量结果弹窗共用同一套状态与错误处理。
 */
export function useBatchDownload() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (assetIds: string[]) => {
    const uniqueIds = [...new Set(assetIds.filter(Boolean))];
    if (!uniqueIds.length || downloading) {
      return false;
    }

    setDownloading(true);
    setError(null);

    try {
      const blob = await apiClient.downloadLibraryAssets(uniqueIds);
      const zipName = `yunwu-library-${new Date().toISOString().slice(0, 10)}.zip`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = zipName;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      // 立刻 revoke 会让部分浏览器取消下载，延后一段时间再释放。
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      return true;
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "下载失败，请稍后重试。",
      );
      return false;
    } finally {
      setDownloading(false);
    }
  }, [downloading]);

  return { download, downloading, error };
}
