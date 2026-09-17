"use client";

import {
  AlertTriangle,
  FileImage,
  WifiOff,
  ScanEye,
  UploadCloud,
} from "lucide-react";
import type { AnalysisErrorVariant } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AnalysisErrorProps {
  variant: AnalysisErrorVariant;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

interface ErrorConfig {
  icon: typeof AlertTriangle;
  title: string;
  message: string;
  tone: string;
  chip: string;
  primaryLabel: string;
  showSecondary: boolean;
}

const CONFIG: Record<AnalysisErrorVariant, ErrorConfig> = {
  busy: {
    icon: AlertTriangle,
    title: "AI service is temporarily busy",
    message:
      "Please try again in a moment. Your uploaded design is safe and hasn't been changed.",
    tone: "text-flag",
    chip: "bg-flag-soft text-flag",
    primaryLabel: "Try again",
    showSecondary: true,
  },
  invalid: {
    icon: FileImage,
    title: "Unsupported image",
    message: "Please upload a JPG, PNG, or WEBP image (up to 10MB).",
    tone: "text-pen",
    chip: "bg-pen-soft text-pen",
    primaryLabel: "Choose another image",
    showSecondary: false,
  },
  network: {
    icon: WifiOff,
    title: "Connection problem",
    message:
      "We couldn't reach the analysis service. Please check your connection and try again.",
    tone: "text-ink-soft",
    chip: "bg-paper-dim text-ink-soft",
    primaryLabel: "Try again",
    showSecondary: true,
  },
  "no-text": {
    icon: ScanEye,
    title: "No readable text found",
    message:
      "We couldn't confidently detect readable text in this design. Try an image with clearer, larger text.",
    tone: "text-flag",
    chip: "bg-flag-soft text-flag",
    primaryLabel: "Upload another design",
    showSecondary: false,
  },
  generic: {
    icon: AlertTriangle,
    title: "Analysis couldn't be completed",
    message:
      "We couldn't complete the AI analysis this time. Your uploaded design is safe. Please try again.",
    tone: "text-pen",
    chip: "bg-pen-soft text-pen",
    primaryLabel: "Try again",
    showSecondary: true,
  },
};

export function AnalysisError({ variant, onPrimary, onSecondary }: AnalysisErrorProps) {
  const config = CONFIG[variant];
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className="w-full max-w-[560px] rounded-panel border border-line bg-surface p-8 text-center shadow-desk animate-fade-up"
    >
      <span
        className={cn(
          "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl",
          config.chip
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
      </span>

      <h2 className="mt-5 text-lg font-semibold tracking-tight text-ink">{config.title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        {config.message}
      </p>

      <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
        {onPrimary && (
          <Button onClick={onPrimary} className="flex-1 sm:flex-none">
            {config.primaryLabel}
          </Button>
        )}
        {config.showSecondary && onSecondary && (
          <Button variant="secondary" onClick={onSecondary} className="flex-1 sm:flex-none">
            <UploadCloud className="h-4 w-4" aria-hidden="true" />
            Choose another image
          </Button>
        )}
      </div>
    </div>
  );
}