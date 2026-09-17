import { Check, TriangleAlert, X } from "lucide-react";
import type { CaseAnalysis as CaseAnalysisType, CaseCheck, CaseStyle } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface CaseAnalysisProps {
  analysis: CaseAnalysisType;
}

const checkConfig: Record<CaseCheck, { icon: typeof Check; tone: "approve" | "flag" | "pen"; label: string }> = {
  pass: { icon: Check, tone: "approve", label: "Pass" },
  warning: { icon: TriangleAlert, tone: "flag", label: "Warning" },
  fail: { icon: X, tone: "pen", label: "Fail" },
};

const styleLabels: Record<CaseStyle, string> = {
  sentence_case: "Sentence case",
  title_case: "Title Case",
  all_caps: "ALL CAPS",
  lowercase: "lowercase",
  mixed_case: "Mixed Case",
};

const rows: { key: keyof Omit<CaseAnalysisType, "detectedStyles" | "overall">; label: string }[] = [
  { key: "sentenceCase", label: "Sentence case" },
  { key: "titleCase", label: "Title case" },
  { key: "keywordCapitalization", label: "Keyword capitalization" },
  { key: "properNouns", label: "Proper nouns" },
];

export function CaseAnalysis({ analysis }: CaseAnalysisProps) {
  const overall = checkConfig[analysis.overall];
  const OverallIcon = overall.icon;

  return (
    <section
      aria-labelledby="case-analysis-heading"
      className="rounded-panel border border-line bg-surface p-6 shadow-soft animate-fade-up"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="case-analysis-heading" className="text-base font-semibold tracking-tight text-ink">
          Case &amp; capitalization
        </h2>
        <Badge tone={overall.tone}>
          <OverallIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {analysis.overall === "pass" ? "Consistent" : analysis.overall === "warning" ? "Inconsistent capitalization" : "Capitalization errors"}
        </Badge>
      </div>

      {analysis.detectedStyles.length > 0 && (
        <p className="mt-2 text-sm text-ink-soft">
          Detected style{analysis.detectedStyles.length > 1 ? "s" : ""}:{" "}
          <span className="text-ink">{analysis.detectedStyles.map((s) => styleLabels[s]).join(", ")}</span>
        </p>
      )}

      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
        {rows.map(({ key, label }) => {
          const check = checkConfig[analysis[key]];
          const Icon = check.icon;
          return (
            <div key={key} className="flex items-center justify-between gap-3 rounded-[6px] border border-line px-3 py-2.5">
              <dt className="text-sm text-ink">{label}</dt>
              <dd className="flex items-center gap-1.5 text-sm font-medium">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    check.tone === "approve" && "text-approve",
                    check.tone === "flag" && "text-flag",
                    check.tone === "pen" && "text-pen"
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    check.tone === "approve" && "text-approve",
                    check.tone === "flag" && "text-flag",
                    check.tone === "pen" && "text-pen"
                  )}
                >
                  {check.label}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
