"use client";

import { useEffect, useState } from "react";
import { Ruler } from "lucide-react";
import {
  MAX_CUSTOM_DIMENSION,
  MIN_CUSTOM_DIMENSION,
  POST_FORMATS,
  clampCustomDimension,
  getPostFormat,
} from "@/lib/formats";
import type { RecreateSelection } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PostFormatSelectProps {
  value: RecreateSelection;
  onChange: (selection: RecreateSelection) => void;
  disabled?: boolean;
}

export function PostFormatSelect({ value, onChange, disabled }: PostFormatSelectProps) {
  const [widthText, setWidthText] = useState(String(value.customWidth));
  const [heightText, setHeightText] = useState(String(value.customHeight));

  useEffect(() => {
    setWidthText(String(value.customWidth));
    setHeightText(String(value.customHeight));
  }, [value.customWidth, value.customHeight]);

  const commitDimension = (text: string, key: "customWidth" | "customHeight") => {
    const parsed = Number(text.trim());
    const fallback = key === "customWidth" ? value.customWidth : value.customHeight;
    const next = text.trim() === "" || !Number.isFinite(parsed) ? fallback : clampCustomDimension(parsed);
    if (next !== value[key]) onChange({ ...value, [key]: next });
  };

  const dimensionsFor = (id: (typeof POST_FORMATS)[number]["id"]): string => {
    if (id === "custom") return `${value.customWidth} × ${value.customHeight}`;
    const format = getPostFormat(id);
    return `${format.width} × ${format.height}`;
  };

  return (
    <div className={cn("rounded-card border border-line bg-surface p-4", disabled && "opacity-60")}>
      <div className="flex items-center gap-2">
        <Ruler className="h-4 w-4 text-pen" aria-hidden="true" />
        <p className="text-sm font-medium text-ink">Post format</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {POST_FORMATS.map((format) => {
          const active = value.format === format.id;
          return (
            <button
              key={format.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onChange({ ...value, format: format.id })}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-[8px] border px-3 py-2 text-left transition-colors",
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-surface text-ink hover:border-ink-faint",
                disabled && "cursor-not-allowed"
              )}
            >
              <span className="text-[13px] font-medium leading-tight">{format.label}</span>
              <span className={cn("text-[11px] leading-tight", active ? "text-paper/70" : "text-ink-faint")}>
                {dimensionsFor(format.id)} px
              </span>
            </button>
          );
        })}
      </div>

      {value.format === "custom" && (
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-line pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-soft">Width (px)</span>
            <input
              type="number"
              min={MIN_CUSTOM_DIMENSION}
              max={MAX_CUSTOM_DIMENSION}
              value={widthText}
              disabled={disabled}
              onChange={(e) => setWidthText(e.target.value)}
              onBlur={() => commitDimension(widthText, "customWidth")}
              className="h-9 w-28 rounded-[8px] border border-line bg-paper-dim/50 px-2.5 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </label>
          <span className="pb-2 text-ink-faint">×</span>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-soft">Height (px)</span>
            <input
              type="number"
              min={MIN_CUSTOM_DIMENSION}
              max={MAX_CUSTOM_DIMENSION}
              value={heightText}
              disabled={disabled}
              onChange={(e) => setHeightText(e.target.value)}
              onBlur={() => commitDimension(heightText, "customHeight")}
              className="h-9 w-28 rounded-[8px] border border-line bg-paper-dim/50 px-2.5 text-sm text-ink focus:border-ink focus:outline-none"
            />
          </label>
          <p className="pb-2 text-xs text-ink-faint">
            {MIN_CUSTOM_DIMENSION}–{MAX_CUSTOM_DIMENSION} px
          </p>
        </div>
      )}
    </div>
  );
}
