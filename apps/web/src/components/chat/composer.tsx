import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Paperclip, SendHorizonal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  getComposerSubmissionGuard,
  resolveComposerCapability,
} from "@/lib/api-mappers";
import type { AssetRecord, CapabilityType, ModelRecord } from "@/lib/api-types";

const capabilityOptions: Array<{ key: CapabilityType; label: string }> = [
  { key: "image.generate", label: "文生图" },
  { key: "image.edit", label: "图片编辑" },
];

function formatAssetMeta(asset: AssetRecord) {
  if (asset.width && asset.height) {
    return `${asset.width}×${asset.height}`;
  }

  return asset.id;
}

export function Composer({
  models,
  disabled,
  uploads = [],
  uploadError,
  isUploading = false,
  initialDraft,
  placeholder,
  submitLabel,
  submitDisabledReason,
  onUpload,
  onRemoveUpload,
  onSubmit,
}: {
  models: ModelRecord[];
  disabled?: boolean;
  uploads?: AssetRecord[];
  uploadError?: string | null;
  isUploading?: boolean;
  initialDraft?: {
    prompt?: string;
    model?: string;
    capability?: CapabilityType;
    params?: Record<string, unknown>;
  };
  placeholder?: string;
  submitLabel?: string;
  submitDisabledReason?: string;
  onUpload?: (file: File) => Promise<void>;
  onRemoveUpload?: (assetId: string) => void;
  onSubmit: (input: {
    prompt: string;
    model: string;
    capability: CapabilityType;
    assetIds?: string[];
    params?: Record<string, unknown>;
  }) => Promise<void>;
}) {
  const enabledModels = useMemo(() => models.filter((item) => item.enabled), [models]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initialSignature = JSON.stringify(initialDraft ?? {});
  const [prompt, setPrompt] = useState(initialDraft?.prompt ?? "");
  const [model, setModel] = useState(initialDraft?.model ?? "");
  const [capability, setCapability] = useState<CapabilityType>(initialDraft?.capability ?? "image.generate");
  const [params, setParams] = useState<Record<string, unknown>>(initialDraft?.params ?? {});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPrompt(initialDraft?.prompt ?? "");
    setModel(initialDraft?.model ?? "");
    setCapability(initialDraft?.capability ?? "image.generate");
    setParams(initialDraft?.params ?? {});
  }, [initialSignature, initialDraft?.capability, initialDraft?.model, initialDraft?.params, initialDraft?.prompt]);

  const selectedModel = model || enabledModels[0]?.id || models[0]?.id || "";
  const effectiveCapability = resolveComposerCapability({
    requestedCapability: capability,
    assetCount: uploads.length,
  });
  const submissionGuard = getComposerSubmissionGuard({
    models,
    modelId: selectedModel,
    requestedCapability: capability,
    assetCount: uploads.length,
  });
  const needsEditAsset = effectiveCapability === "image.edit" && uploads.length === 0;
  const uploadForcesEdit = uploads.length > 0;
  const effectiveSubmitDisabledReason = submissionGuard.reason ?? submitDisabledReason ?? null;
  const isSubmitDisabled =
    !prompt.trim() ||
    !selectedModel ||
    disabled ||
    isSubmitting ||
    needsEditAsset ||
    isUploading ||
    Boolean(effectiveSubmitDisabledReason);

  useEffect(() => {
    if (uploadForcesEdit && capability !== "image.edit") {
      setCapability("image.edit");
    }
  }, [capability, uploadForcesEdit]);

  async function handleSubmit() {
    const trimmedPrompt = prompt.trim();
    if (isSubmitDisabled) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        prompt: trimmedPrompt,
        model: selectedModel,
        capability: effectiveCapability,
        assetIds: uploads.map((asset) => asset.id),
        params,
      });
      setPrompt("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !onUpload) {
      return;
    }

    try {
      await onUpload(file);
    } finally {
      event.target.value = "";
    }
  }

  return (
    <Card className="border-white/10 bg-black/20">
      <div className="space-y-4 p-4">
        {uploads.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {uploads.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-foreground"
              >
                <span>{asset.mimeType || "image"}</span>
                <span className="text-muted-foreground">{formatAssetMeta(asset)}</span>
                {onRemoveUpload ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => onRemoveUpload(asset.id)}
                    aria-label="移除已选资产"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {needsEditAsset ? (
          <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            图片编辑需要先上传或选择至少一张参考图。
          </div>
        ) : null}

        {uploadForcesEdit ? (
          <div className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
            已检测到上传图，本次提交会按图片编辑处理；如需文生图，请先移除上传图。
          </div>
        ) : null}

        {uploadError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            上传失败：{uploadError}
          </div>
        ) : null}

        {submissionGuard.reason && !needsEditAsset ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {submissionGuard.reason}
          </div>
        ) : null}

        <Textarea
          className="min-h-[110px] resize-none border-white/10 bg-white/[0.03]"
          placeholder={placeholder ?? "输入提示词、编辑指令或任务描述。发送后会创建真实任务。"}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={disabled || isSubmitting}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || isSubmitting || isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4" />
              {isUploading ? "上传中..." : "上传"}
            </Button>
            <label className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              <span>模型</span>
              <select
                aria-label="模型"
                className="bg-transparent text-foreground outline-none"
                value={selectedModel}
                onChange={(event) => setModel(event.target.value)}
                disabled={disabled || isSubmitting || models.length === 0}
              >
                {models.length === 0 ? <option value="">暂无模型</option> : null}
                {models.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name || option.id}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5" />
            </label>
            <label className="inline-flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              <span>能力</span>
              <select
                aria-label="能力"
                className="bg-transparent text-foreground outline-none"
                value={effectiveCapability}
                onChange={(event) => setCapability(event.target.value as CapabilityType)}
                disabled={disabled || isSubmitting}
              >
                {capabilityOptions.map((option) => (
                  <option
                    key={option.key}
                    value={option.key}
                    disabled={uploadForcesEdit && option.key === "image.generate"}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" disabled>
              保存草稿
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              title={effectiveSubmitDisabledReason ?? undefined}
            >
              <SendHorizonal className="h-4 w-4" />
              {isSubmitting ? "发送中..." : submitLabel ?? "发送"}
            </Button>
          </div>
        </div>
        {submitDisabledReason && !submissionGuard.reason ? (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-muted-foreground">
            {submitDisabledReason}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
