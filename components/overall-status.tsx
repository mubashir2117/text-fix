import { Check, TriangleAlert, X } from "lucide-react";
import type { OverallStatus as StatusType } from "@/lib/types";
import { cn, formatConfidence, statusLabel } from "@/lib/utils";

interface OverallStatusProps {
  status: StatusType;
  qualityScore: number;
  confidence: number;
}

const config: Record<StatusType, { icon: typeof Check; tone: string; ring: string }> = {
  correct: { icon: Check, tone: "text-approve", ring: "border-approve/40 bg-approve-soft" },
  needs_improvement: { icon: TriangleAlert, tone: "text-flag", ring: "border-flag/40 bg-flag-soft" },
  incorrect: { icon: X, tone: "text-pen", ring: "border-pen/40 bg-pen-soft" },
};

export function OverallStatus({ status, qualityScore, confidence }: OverallStatusProps) {
  const { icon: Icon, tone, ring } = config[status];

  return (
    <div className={cn("flex flex-col gap-5 rounded-card border p-6 sm:flex-row sm:items-center sm:justify-between", ring)}>
      <div className="flex items-center gap-3">
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface", tone)}>
          <Icon className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div>
          <p className={cn("font-serif text-xl", tone)}>{statusLabel(status)}</p>
          <p className="text-sm text-ink-soft">
            AI confidence in this assessment: {formatConfidence(confidence)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-serif text-3xl text-ink">{Math.round(qualityScore)}</span>
          <span className="text-sm text-ink-soft">/100</span>
        </div>
        <p className="text-xs text-ink-faint sm:text-right">
          An AI-generated estimate, not an objective grade.
        </p>
      </div>
    </div>
  );
}
