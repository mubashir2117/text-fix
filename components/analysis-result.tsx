import type { AnalysisResult } from "@/lib/types";
import { ImagePreview } from "@/components/image-preview";
import { OverallStatus } from "@/components/overall-status";
import { ExtractedText } from "@/components/extracted-text";
import { CorrectionCard } from "@/components/correction-card";
import { CopyReview } from "@/components/copy-review";
import { IssueCard } from "@/components/issue-card";
import { AnalysisSummary } from "@/components/analysis-summary";

interface AnalysisResultViewProps {
  previewUrl: string;
  result: AnalysisResult;
}

export function AnalysisResultView({ previewUrl, result }: AnalysisResultViewProps) {
  const sortedIssues = [...result.issues].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <ImagePreview src={previewUrl} />
      </div>

      <div className="flex flex-col gap-6">
        <OverallStatus status={result.overallStatus} qualityScore={result.qualityScore} confidence={result.confidence} />

        {result.notes && (
          <p className="rounded-card border border-line bg-paper-dim/60 px-4 py-3 text-sm text-ink-soft">
            {result.notes}
          </p>
        )}

        <ExtractedText text={result.extractedText} ocrConfidence={result.ocrConfidence} />

        {result.correctedText && <CorrectionCard correctedText={result.correctedText} />}

        {sortedIssues.length > 0 && (
          <section aria-labelledby="issues-heading" className="rounded-card border border-line bg-surface p-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="issues-heading" className="font-serif text-lg text-ink">
                Issues found
              </h2>
            </div>
            <div className="mt-1">
              <AnalysisSummary issues={sortedIssues} />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {sortedIssues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          </section>
        )}

        <CopyReview review={result.copyReview} />
      </div>
    </div>
  );
}
