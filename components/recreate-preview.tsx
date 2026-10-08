"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Check,
  Columns2,
  Download,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Type as TypeIcon,
} from "lucide-react";
import { RecreatedPost } from "@/components/recreated-post";
import { TextReport } from "@/components/text-report";
import { RetryNotice } from "@/components/retry-notice";
import { Button } from "@/components/ui/button";
import type { ApiProgressEvent } from "@/lib/errors";
import {
  buildExportFilename,
  downloadBlob,
  exportElement,
  getExportFormat,
  type ExportFormatId,
} from "@/lib/export-image";
import { getPostFormat, type NormalizedRecreation } from "@/lib/formats";
import type { RecreateBusyAction, RecreateSelection } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RecreatePreviewProps {
  originalUrl: string;
  recreation: NormalizedRecreation;
  selection: RecreateSelection;
  busy: RecreateBusyAction;
  /** Live retry progress while the server retries transient Gemini errors. */
  retry?: ApiProgressEvent | null;
  canReset: boolean;
  onRegenerate: () => void;
  onImprove: () => void;
  onFixText: () => void;
  onReset: () => void;
}

const BUSY_LABEL: Record<Exclude<RecreateBusyAction, null>, string> = {
  create: "Recreating your post...",
  regenerate: "Generating another professional version...",
  improve: "Improving spacing, typography and contrast...",
  fix: "Applying the corrected copy...",
  download: "Preparing your download...",
};

const ALIGNMENT_ICON = {
  left: AlignLeft,
  center: AlignCenter,
  right: AlignRight,
} as const;

export function RecreatePreview({
  originalUrl,
  recreation,
  selection,
  busy,
  retry,
  canReset,
  onRegenerate,
  onImprove,
  onFixText,
  onReset,
}: RecreatePreviewProps) {
  const [showCompare, setShowCompare] = useState(false);
  const [compareValue, setCompareValue] = useState(50);
  const [downloading, setDownloading] = useState<ExportFormatId | null>(null);
  const exportNodeRef = useRef<HTMLDivElement>(null);

  const width = selection.format === "custom" ? selection.customWidth : getPostFormat(selection.format).width;
  const height = selection.format === "custom" ? selection.customHeight : getPostFormat(selection.format).height;
  const formatLabel = getPostFormat(selection.format).label;

  const handleDownload = async (formatId: ExportFormatId) => {
    const node = exportNodeRef.current;
    if (!node || downloading) return;
    setDownloading(formatId);
    try {
      const blob = await exportElement(node, formatId, { backgroundColor: recreation.design.background });
      downloadBlob(blob, buildExportFilename(selection.format, getExportFormat(formatId).extension, width, height));
      toast.success(`Downloaded ${formatId.toUpperCase()} — ${width} × ${height}`);
    } catch {
      toast.error("We couldn't export the image. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const AlignIcon = ALIGNMENT_ICON[recreation.design.alignment];

  const metaTiles = [
    {
      label: "Alignment",
      value: `${recreation.design.alignment[0].toUpperCase()}${recreation.design.alignment.slice(1)}`,
      icon: AlignIcon,
    },
    { label: "Layout", value: recreation.layout.template.replace(/_/g, " "), icon: Columns2 },
    { label: "Typeface", value: recreation.typeStyles.fontFamily, icon: TypeIcon },
  ];

  return (
    <div className="space-y-5">
      {/* ORIGINAL POST vs CORRECTED POST — desktop side by side, mobile stacked (§9) */}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl text-ink">Original vs corrected post</h2>
        <p className="text-xs text-ink-faint">Same design — corrected text presentation.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Original post">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-paper-dim px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
              Original post
            </span>
            <span className="text-xs text-ink-faint">Uploaded design</span>
          </div>
          <div className="rounded-card border border-line bg-surface p-3">
            <div
              className="relative mx-auto w-full max-w-[460px] overflow-hidden rounded-[6px] bg-paper-dim"
              style={{ aspectRatio: `${width} / ${height}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={originalUrl}
                alt="Original uploaded design"
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
          </div>
        </section>

        <section aria-label="Corrected post">
          <div className="mb-2 flex items-center justify-between">
            <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-paper">
              Corrected post
            </span>
            <span className="text-xs text-ink-faint">
              {formatLabel} · {width} × {height}
            </span>
          </div>
          <div className="flex justify-center rounded-card border border-line bg-surface p-3">
            <div className="w-full max-w-[460px] overflow-hidden rounded-[6px] shadow-desk">
              <RecreatedPost recreation={recreation} width={width} height={height} />
            </div>
          </div>
        </section>
      </div>

      {/* BEFORE / AFTER */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={showCompare ? "primary" : "secondary"}
          size="sm"
          onClick={() => setShowCompare((prev) => !prev)}
          aria-pressed={showCompare}
        >
          <Columns2 className="h-4 w-4" aria-hidden="true" />
          {showCompare ? "Hide before / after" : "Before / after"}
        </Button>
        <p className="text-xs text-ink-faint">Drag the slider to compare the original with your corrected post.</p>
      </div>

      {showCompare && (
        <section
          aria-label="Before and after comparison"
          className="rounded-card border border-line bg-surface p-4"
        >
          <div className="mx-auto w-full max-w-[460px]">
            <div
              className="relative overflow-hidden rounded-[6px] border border-line"
              style={{ aspectRatio: `${width} / ${height}` }}
            >
              <RecreatedPost recreation={recreation} width={width} height={height} />
              <div
                className="absolute inset-0"
                style={{ clipPath: `inset(0 ${100 - compareValue}% 0 0)` }}
                aria-hidden
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </div>
              <span className="absolute left-2 top-2 rounded bg-ink/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-paper">
                Before
              </span>
              <span className="absolute right-2 top-2 rounded bg-ink/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-paper">
                After
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={compareValue}
              onChange={(e) => setCompareValue(Number(e.target.value))}
              aria-label="Before and after comparison slider"
              className="mt-3 w-full accent-pen"
            />
          </div>
        </section>
      )}

      {/* ACTIONS */}
      <div className="rounded-card border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button onClick={onRegenerate} disabled={busy !== null}>
            <RefreshCw className={cn("h-4 w-4", busy === "regenerate" && "animate-spin")} aria-hidden="true" />
            Regenerate
          </Button>
          <Button variant="secondary" onClick={onImprove} disabled={busy !== null}>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Improve design
          </Button>
          <Button variant="secondary" onClick={onFixText} disabled={busy !== null}>
            <TypeIcon className="h-4 w-4" aria-hidden="true" />
            Fix text
          </Button>
          <Button variant="ghost" onClick={onReset} disabled={!canReset || busy !== null}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset
          </Button>

          <div className="ml-auto flex items-center gap-2">
            <Button
              onClick={() => handleDownload("png")}
              disabled={busy !== null || downloading !== null}
              className="min-w-[150px]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {downloading === "png" ? "Preparing..." : "Download PNG"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleDownload("jpg")}
              disabled={busy !== null || downloading !== null}
            >
              {downloading === "jpg" ? "Preparing..." : "JPG"}
            </Button>
          </div>
        </div>

        {(busy || downloading) && (
          <div className="mt-2.5">
            <p role="status" aria-live="polite" className="text-sm text-pen">
              {downloading
                ? "Rendering your file..."
                : BUSY_LABEL[busy as Exclude<RecreateBusyAction, null>]}
            </p>
            {!downloading && <RetryNotice retry={retry} />}
          </div>
        )}
      </div>

      {/* ORIGINAL vs CORRECTED REPORT — what improved, text analysis, summary (§10–§13) */}
      <TextReport recreation={recreation} />

      {/* RECREATION DETAILS */}
      <div className="grid gap-4 sm:grid-cols-2">
        {recreation.improvementReport.length === 0 && recreation.improvements.length > 0 && (
          <div className="rounded-card border border-line bg-surface p-4">
            <p className="text-sm font-medium text-ink">Improvements</p>
            <ul className="mt-2 space-y-1.5">
              {recreation.improvements.map((improvement) => (
                <li key={improvement} className="flex items-start gap-2 text-sm text-ink-soft">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-approve" aria-hidden="true" />
                  {improvement}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap gap-2">
            {metaTiles.map((tile) => (
              <div key={tile.label} className="flex items-center gap-2 rounded-[8px] bg-paper-dim/60 px-2.5 py-1.5">
                <tile.icon className="h-3.5 w-3.5 text-ink-soft" aria-hidden="true" />
                <span className="text-xs text-ink-soft">
                  <span className="font-medium text-ink">{tile.label}:</span> {tile.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            {[
              { label: "Primary", color: recreation.design.primaryColor },
              { label: "Secondary", color: recreation.design.secondaryColor },
              { label: "Accent", color: recreation.design.accentColor },
              { label: "Background", color: recreation.design.background },
            ].map((swatch) => (
              <div key={swatch.label} className="flex items-center gap-1.5">
                <span
                  className="h-4 w-4 rounded border border-line"
                  style={{ background: swatch.color }}
                  title={`${swatch.label}: ${swatch.color}`}
                  aria-hidden
                />
                <span className="text-[11px] text-ink-faint">{swatch.label}</span>
              </div>
            ))}
          </div>

          {recreation.design.visualHierarchy && (
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
              <span className="font-medium text-ink">Visual hierarchy:</span> {recreation.design.visualHierarchy}
            </p>
          )}

          {recreation.notes && (
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">Note: {recreation.notes}</p>
          )}
        </div>
      </div>

      {/* Full-resolution copy used for PNG/JPG export (offscreen). */}
      <div
        aria-hidden
        ref={exportNodeRef}
        style={{ position: "fixed", left: -100000, top: 0, width, height, pointerEvents: "none" }}
      >
        <RecreatedPost recreation={recreation} width={width} height={height} scale={1} />
      </div>
    </div>
  );
}
