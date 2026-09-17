"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const STAGES = [
  "Reading image...",
  "Extracting text...",
  "Checking grammar...",
  "Reviewing copy...",
  "Preparing results...",
];

export function AnalysisLoader() {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 1400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[280px] flex-col items-center justify-center gap-6 rounded-card border border-line bg-surface px-6 py-14 text-center"
    >
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        className="text-pen"
      >
        <circle cx="32" cy="32" r="28" stroke="currentColor" strokeOpacity="0.15" strokeWidth="3" />
        <path
          d="M32 4a28 28 0 0 1 28 28"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          className="origin-center animate-spin"
          style={{ animationDuration: "1.1s" }}
        />
      </svg>
      <div>
        <p className="font-serif text-xl text-ink">Analyzing your design...</p>
        <p className="mt-2 text-sm text-ink-soft" key={stageIndex}>
          {STAGES[stageIndex]}
        </p>
      </div>
      <span className="sr-only">{STAGES[stageIndex]}</span>
    </div>
  );
}
