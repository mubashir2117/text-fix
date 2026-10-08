"use client";

import { RefreshCw } from "lucide-react";
import type { ApiProgressEvent } from "@/lib/errors";

interface RetryNoticeProps {
  retry: ApiProgressEvent | null | undefined;
}

/**
 * Live "Retry attempt N/4" banner shown while the server retries a
 * transient Gemini error (408/429/500/502/503/504) with backoff.
 * Streamed from the analyze/recreate routes as server-sent events.
 */
export function RetryNotice({ retry }: RetryNoticeProps) {
  if (!retry) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex max-w-sm items-start gap-3 rounded-card border border-flag/40 bg-flag-soft/50 px-4 py-3 text-left"
    >
      <RefreshCw
        className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-flag"
        style={{ animationDuration: "2s" }}
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-medium text-ink">
          {retry.message ?? "Gemini is temporarily unavailable. Retrying automatically..."}
        </p>
        <p className="mt-0.5 text-xs text-ink-soft">
          Retry attempt {retry.retry}/{retry.maxRetries}
        </p>
      </div>
    </div>
  );
}
