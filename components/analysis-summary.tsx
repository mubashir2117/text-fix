import type { TextIssue } from "@/lib/types";
import { severityWeight } from "@/lib/utils";

interface AnalysisSummaryProps {
  issues: TextIssue[];
}

export function AnalysisSummary({ issues }: AnalysisSummaryProps) {
  if (issues.length === 0) {
    return (
      <p className="text-sm text-ink-soft">
        No issues were flagged — the extracted text reads as correct.
      </p>
    );
  }

  const bySeverity = issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.severity] = (acc[issue.severity] ?? 0) + 1;
    return acc;
  }, {});

  const ordered = Object.entries(bySeverity).sort(
    ([a], [b]) => severityWeight(a) - severityWeight(b)
  );

  return (
    <p className="text-sm text-ink-soft">
      {issues.length} {issues.length === 1 ? "issue" : "issues"} found —{" "}
      {ordered.map(([severity, count], i) => (
        <span key={severity}>
          {count} {severity}
          {i < ordered.length - 1 ? ", " : ""}
        </span>
      ))}
      .
    </p>
  );
}
