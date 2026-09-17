"use client";

import { useEffect, useState } from "react";

interface QualityScoreProps {
  score: number;
  label?: string;
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function QualityScore({ score, label = "Quality Score" }: QualityScoreProps) {
  const [value, setValue] = useState(0);
  const [display, setDisplay] = useState(0);
  const target = Math.max(0, Math.min(100, Math.round(score)));

  useEffect(() => {
    const raf = requestAnimationFrame(() => setValue(target));
    return () => cancelAnimationFrame(raf);
  }, [target]);

  useEffect(() => {
    const duration = 900;
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const offset = CIRCUMFERENCE * (1 - value / 100);

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div
        className="relative h-[104px] w-[104px]"
        role="img"
        aria-label={`${label}: ${target} out of 100`}
      >
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-line"
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="text-ink transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="font-serif text-[28px] leading-none text-ink">{display}</p>
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-faint">/100</p>
      </div>
    </div>
  );
}