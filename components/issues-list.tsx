import { FileWarning } from "lucide-react";
import type { TextIssue } from "@/lib/types";
import { IssueCard } from "@/components/issue-card";

interface IssuesListProps {
  issues: TextIssue[];
}

const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function IssuesList({ issues }: IssuesListProps) {
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <section aria-labelledby="issues-heading" className="animate-fade-up">
      <div className="mb-4 flex items-center gap-3">
        <h2 id="issues-heading" className="text-base font-semibold tracking-tight text-ink">
          Issues Found
        </h2>
        {issues.length > 0 && (
          <span className="rounded-full bg-paper-dim px-2.5 py-0.5 text-xs font-medium text-ink-soft">
            {issues.length}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center gap-2.5 rounded-panel border border-line bg-surface px-6 py-5 text-sm text-ink-soft shadow-soft">
          <FileWarning className="h-4 w-4 shrink-0 text-approve" aria-hidden="true" />
          <p>No issues were flagged — the extracted text reads as correct.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {sorted.map((issue, index) => (
            <div
              key={issue.id}
              className="animate-fade-up"
              style={{ animationDelay: `${Math.min(index * 60, 420)}ms` }}
            >
              <IssueCard issue={issue} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}