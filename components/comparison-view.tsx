import { Minus, Plus } from "lucide-react";
import { diffWords, type DiffSegment } from "@/lib/diff";

interface ComparisonViewProps {
  original: string;
  corrected: string;
}

export function ComparisonView({ original, corrected }: ComparisonViewProps) {
  const segments = diffWords(original, corrected);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-line bg-paper-dim/40 p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">
          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
          Original
        </p>
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
          {renderSegments(segments, "removed", "added")}
        </p>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-approve">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Corrected
        </p>
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {renderSegments(segments, "added", "removed")}
        </p>
      </div>
    </div>
  );
}

function renderSegments(
  segments: DiffSegment[],
  showType: DiffSegment["type"],
  hideType: DiffSegment["type"]
) {
  return segments.map((seg, i) => {
    if (seg.type === "same") {
      return <span key={i}>{seg.text}</span>;
    }
    if (seg.type === hideType) {
      return null;
    }
    if (showType === "removed") {
      return (
        <span
          key={i}
          className="rounded bg-pen-soft/80 px-0.5 text-pen line-through decoration-2 decoration-pen/40"
        >
          {seg.text}
        </span>
      );
    }
    return (
      <span
        key={i}
        className="rounded bg-approve-soft/90 px-0.5 font-medium text-approve underline decoration-approve/40 decoration-2 underline-offset-2"
      >
        {seg.text}
      </span>
    );
  });
}