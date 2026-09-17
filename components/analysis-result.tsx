import type { AnalysisResult } from "@/lib/types";
import { ImagePreview } from "@/components/image-preview";
import { AnalysisSummary } from "@/components/analysis-summary";
import { IssuesList } from "@/components/issues-list";
import { ExtractedText } from "@/components/extracted-text";
import { CorrectedCopy } from "@/components/corrected-copy";
import { CopyReview } from "@/components/copy-review";
import { CaseAnalysis } from "@/components/case-analysis";
import { KeywordAnalysis } from "@/components/keyword-analysis";

interface AnalysisResultViewProps {
  previewUrl: string;
  result: AnalysisResult;
}

export function AnalysisResultView({ previewUrl, result }: AnalysisResultViewProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <ImagePreview src={previewUrl} />
        {result.notes && (
          <p className="mt-3 px-1 text-xs leading-relaxed text-ink-faint">{result.notes}</p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <AnalysisSummary
          status={result.overallStatus}
          qualityScore={result.qualityScore}
          confidence={result.confidence}
          ocrConfidence={result.ocrConfidence}
          issueCount={result.issues.length}
        />

        <IssuesList issues={result.issues} />

        <ExtractedText text={result.extractedText} ocrConfidence={result.ocrConfidence} />

        {result.correctedText && (
          <CorrectedCopy
            originalText={result.extractedText}
            correctedText={result.correctedText}
          />
        )}

        {result.caseAnalysis && <CaseAnalysis analysis={result.caseAnalysis} />}

        {result.keywordAnalysis && result.keywordAnalysis.length > 0 && (
          <KeywordAnalysis entries={result.keywordAnalysis} />
        )}

        <CopyReview review={result.copyReview} />
      </div>
    </div>
  );
}