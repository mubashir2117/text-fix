import { Check, TriangleAlert } from "lucide-react";
import type { KeywordAnalysisEntry } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface KeywordAnalysisProps {
  entries: KeywordAnalysisEntry[];
}

export function KeywordAnalysis({ entries }: KeywordAnalysisProps) {
  if (entries.length === 0) return null;

  return (
    <section
      aria-labelledby="keyword-analysis-heading"
      className="rounded-panel border border-line bg-surface p-6 shadow-soft animate-fade-up"
    >
      <h2 id="keyword-analysis-heading" className="text-base font-semibold tracking-tight text-ink">
        Keyword consistency
      </h2>
      <p className="mt-0.5 text-xs text-ink-faint">
        Repeated keywords and brand terms, checked for consistent capitalization.
      </p>

      <div className="mt-4 flex flex-col divide-y divide-line border-t border-line">
        {entries.map((entry) => (
          <div key={entry.keyword} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-serif text-base text-ink">{entry.recommendedForm}</p>
              <p className="mt-0.5 text-sm text-ink-soft">
                Found as: {entry.detectedVariants.map((v) => `"${v}"`).join(", ")}
              </p>
            </div>
            <Badge tone={entry.consistent ? "approve" : "flag"}>
              {entry.consistent ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Consistent
                </>
              ) : (
                <>
                  <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                  Inconsistent
                </>
              )}
            </Badge>
          </div>
        ))}
      </div>
    </section>
  );
}
