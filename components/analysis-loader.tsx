"use client";

import { useEffect, useState } from "react";
import { Check, CircleDashed, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  "Reading visible text",
  "Checking spelling & grammar",
  "Reviewing capitalization",
  "Checking clarity & CTA",
];

export function AnalysisLoader() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => (prev >= STEPS.length ? prev : prev + 1));
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const allDone = phase >= STEPS.length;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative overflow-hidden rounded-panel border border-line bg-surface p-8 shadow-desk animate-fade-in"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden" aria-hidden="true">
        <div className="h-full w-1/3 bg-ink/10 animate-scan" />
      </div>

      <div className="flex flex-col items-center gap-7 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper">
          <LoaderCircle
            className="h-5 w-5 text-ink animate-spin"
            style={{ animationDuration: "1.2s" }}
            aria-hidden="true"
          />
        </div>

        <div>
          <p className="text-lg font-semibold tracking-tight text-ink">Analyzing your design</p>
          <p className="mt-1 text-sm text-ink-soft">
            {allDone ? "Finalizing your report…" : "The AI is reading your design carefully."}
          </p>
        </div>

        <ul className="w-full max-w-sm space-y-1.5 text-left" aria-label="Analysis steps">
          {STEPS.map((step, index) => {
            const done = index < phase;
            const active = index === phase;
            return (
              <li
                key={step}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition-all duration-300",
                  done && "border-approve/25 bg-approve-soft/60 text-ink",
                  active && "border-line bg-paper/70 text-ink",
                  !done && !active && "border-transparent text-ink-faint"
                )}
              >
                {done ? (
                  <Check className="h-4 w-4 shrink-0 text-approve" strokeWidth={2.5} aria-hidden="true" />
                ) : active ? (
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true">
                    <span
                      className="absolute h-2.5 w-2.5 rounded-full bg-ink/80 animate-ping"
                      style={{ animationDuration: "1.4s" }}
                    />
                    <span className="h-2.5 w-2.5 rounded-full bg-ink/80" />
                  </span>
                ) : (
                  <CircleDashed className="h-4 w-4 shrink-0 text-line" strokeWidth={1.5} aria-hidden="true" />
                )}
                <span className={cn((done || active) && "font-medium")}>{step}</span>
                {active && (
                  <span className="ml-auto text-xs font-medium text-ink-faint">in progress</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}