import { AlertOctagon, AlertTriangle, CircleDot, Info } from "lucide-react";
import type { TextIssue } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface IssueCardProps {
  issue: TextIssue;
}

const severityConfig = {
  critical: { icon: AlertOctagon, tone: "pen" as const, label: "Critical" },
  high: { icon: AlertTriangle, tone: "pen" as const, label: "High" },
  medium: { icon: CircleDot, tone: "flag" as const, label: "Medium" },
  low: { icon: Info, tone: "muted" as const, label: "Low" },
};

const typeLabels: Record<TextIssue["type"], string> = {
  spelling: "Spelling",
  grammar: "Grammar",
  punctuation: "Punctuation",
  capitalization: "Capitalization",
  wording: "Wording",
  structure: "Sentence structure",
  clarity: "Clarity",
  duplication: "Repetition",
  cta: "Call to action",
  other: "Copy issue",
};

export function IssueCard({ issue }: IssueCardProps) {
  const { icon: Icon, tone, label } = severityConfig[issue.severity];

  return (
    <article className="relative overflow-hidden rounded-panel border border-line bg-surface p-5 pl-6 shadow-soft">
      <span
        className={cn(
          "absolute left-0 top-5 bottom-5 w-[3px] rounded-full",
          issue.severity === "low"
            ? "bg-line"
            : tone === "pen"
              ? "bg-pen"
              : "bg-flag"
        )}
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            tone === "pen" ? "text-pen" : tone === "flag" ? "text-flag" : "text-ink-faint"
          )}
          aria-hidden="true"
        />
        <span className="text-sm font-semibold text-ink">{typeLabels[issue.type]}</span>
        <Badge tone={tone}>{label}</Badge>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
            Original
          </p>
          <p className="mt-1.5 rounded-lg border border-line/70 bg-paper-dim/40 px-3 py-2 text-sm leading-relaxed text-ink-soft line-through decoration-pen/50 decoration-2">
            {issue.original}
          </p>
        </div>
        {issue.correction && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              Suggested
            </p>
            <p className="mt-1.5 rounded-lg border border-approve/30 bg-approve-soft/50 px-3 py-2 text-sm font-medium leading-relaxed text-ink">
              {issue.correction}
            </p>
          </div>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{issue.explanation}</p>
    </article>
  );
}