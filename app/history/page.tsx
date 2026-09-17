"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { HistoryEntry } from "@/lib/types";
import { getHistory, clearHistory } from "@/lib/history";
import { formatDate, statusLabel, cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { AnalysisResultView } from "@/components/analysis-result";
import { Button } from "@/components/ui/button";

const statusTone: Record<string, string> = {
  correct: "text-approve",
  needs_improvement: "text-flag",
  incorrect: "text-pen",
};

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    setEntries(getHistory());
  }, []);

  function handleClear() {
    clearHistory();
    setEntries([]);
    setSelected(null);
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">History</h1>
          <p className="mt-2 max-w-lg text-ink-soft">
            Saved on this device. Nothing here is sent anywhere else.
          </p>
        </div>
        {entries && entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Clear history
          </Button>
        )}
      </div>

      {selected && (
        <div className="mb-10">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mb-4 text-sm font-medium text-ink-soft hover:text-ink"
          >
            ← Back to all history
          </button>
          <AnalysisResultView previewUrl={selected.thumbnailDataUrl} result={selected.result} />
        </div>
      )}

      {!selected && entries === null && <p className="text-sm text-ink-soft">Loading...</p>}

      {!selected && entries !== null && entries.length === 0 && (
        <EmptyState
          title="No analyses yet"
          description="Designs you analyze will show up here, saved right on this device."
          action={
            <Link href="/analyze">
              <Button size="sm">Analyze a design</Button>
            </Link>
          }
        />
      )}

      {!selected && entries !== null && entries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelected(entry)}
              className="flex flex-col overflow-hidden rounded-card border border-line bg-surface text-left shadow-desk transition-transform hover:-translate-y-0.5"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-paper-dim">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.thumbnailDataUrl} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-xs font-medium", statusTone[entry.result.overallStatus])}>
                    {statusLabel(entry.result.overallStatus)}
                  </span>
                  <span className="text-xs text-ink-faint">{formatDate(entry.createdAt)}</span>
                </div>
                <p className="line-clamp-2 text-sm text-ink-soft">{entry.result.extractedText || "No text detected"}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
