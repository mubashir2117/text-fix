import { Check, TriangleAlert, X } from "lucide-react";
import type { OverallStatus } from "@/lib/types";
import { cn, formatConfidence } from "@/lib/utils";
import { QualityScore } from "@/components/quality-score";

interface AnalysisSummaryProps {
  status: OverallStatus;
  qualityScore: number;
  confidence: number;
  ocrConfidence: number;
  issueCount: number;
}

const statusConfig: Record<
  OverallStatus,
  { icon: typeof Check; label: string; badge: string }
> = {
  correct: {
    icon: Check,
    label: "Correct",
    badge: "border-approve/30 bg-approve-soft text-approve",
  },
  needs_improvement: {
    icon: TriangleAlert,
    label: "Needs improvement",
    badge: "border-flag/30 bg-flag-soft text-flag",
  },
  incorrect: {
    icon: X,
    label: "Incorrect",
    badge: "border-pen/30 bg-pen-soft text-pen",
  },
};

function StatBar({ label, value }: { label: string; value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-soft">{label}</p>
        <p className="text-sm font-semibold text-ink">{formatConfidence(value)}</p>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper-dim"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function AnalysisSummary({
  status,
  qualityScore,
  confidence,
  ocrConfidence,
  issueCount,
}: AnalysisSummaryProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <section
      aria-labelledby="analysis-summary-heading"
      className="overflow-hidden rounded-panel border border-line bg-surface shadow-desk animate-fade-up"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <h2
          id="analysis-summary-heading"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft"
        >
          Analysis complete
        </h2>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
            config.badge
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {config.label}
        </span>
      </div>

      <div className="flex flex-col items-center gap-7 px-6 py-6 sm:flex-row sm:items-center">
        <QualityScore score={qualityScore} />

        <div className="w-full flex-1 space-y-4">
          <StatBar label="Confidence" value={confidence} />
          <StatBar label="OCR confidence" value={ocrConfidence} />
          <p className="text-xs leading-relaxed text-ink-faint">
            {issueCount > 0
              ? `${issueCount} ${issueCount === 1 ? "issue" : "issues"} flagged in your copy. `
              : "No issues detected in the copy. "}
            AI-generated assessment, not an objective grade.
          </p>
        </div>
      </div>
    </section>
  );
}