"use client";

import { useEffect, useState } from "react";
import { RetryNotice } from "@/components/retry-notice";
import type { ApiProgressEvent } from "@/lib/errors";

/**
 * Staged loader mirroring the "Recreate & Compare Post" user flow:
 * upload → analyze original design → extract visible text → check
 * sentence/title case → check alignment → check spacing & hierarchy →
 * recreate the same post → compare original vs corrected → preview.
 */
const STAGES = [
  "Analyzing the original design...",
  "Extracting visible text...",
  "Checking sentence case, Title Case and uppercase...",
  "Checking text alignment...",
  "Checking spacing and hierarchy...",
  "Recreating the same post...",
  "Comparing original vs corrected...",
  "Preparing your preview...",
];

interface RecreateLoaderProps {
  /** Live retry progress while the server retries transient Gemini errors. */
  retry?: ApiProgressEvent | null;
}

export function RecreateLoader({ retry }: RecreateLoaderProps) {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 1600);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[320px] flex-col items-center justify-center gap-6 rounded-card border border-line bg-surface px-6 py-14 text-center"
    >
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true" className="text-pen">
        <rect x="8" y="8" width="48" height="48" rx="10" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <path
          d="M56 22A22 22 0 0 0 14 16"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="origin-center animate-spin"
          style={{ animationDuration: "1.2s" }}
        />
        <path d="M20 40l8-9 7 7 9-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <p className="font-serif text-xl text-ink">Recreating your post...</p>
        <p className="mt-2 text-sm text-ink-soft" key={stageIndex}>
          {STAGES[stageIndex]}
        </p>
      </div>
      <div className="h-1.5 w-56 overflow-hidden rounded-full bg-paper-dim">
        <div
          className="h-full rounded-full bg-pen transition-all duration-700"
          style={{ width: `${((stageIndex + 1) / STAGES.length) * 100}%` }}
        />
      </div>
      <RetryNotice retry={retry} />
      <span className="sr-only">{STAGES[stageIndex]}</span>
    </div>
  );
}
