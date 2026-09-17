"use client";

import { useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { ComparisonView } from "@/components/comparison-view";
import { cn } from "@/lib/utils";

interface CorrectedCopyProps {
  originalText: string;
  correctedText: string;
}

export function CorrectedCopy({ originalText, correctedText }: CorrectedCopyProps) {
  const [compare, setCompare] = useState(false);

  return (
    <section
      aria-labelledby="corrected-copy-heading"
      className="overflow-hidden rounded-panel border border-approve/25 bg-surface shadow-soft animate-fade-up"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-approve/15 px-6 py-4">
        <div>
          <h2 id="corrected-copy-heading" className="text-base font-semibold tracking-tight text-ink">
            Corrected Copy
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Meaning preserved — brand names, prices, and links untouched.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={correctedText} label="Copy corrected text" variant="primary" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCompare((v) => !v)}
            aria-expanded={compare}
            className={cn(compare && "border-ink bg-ink text-paper")}
          >
            <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
            {compare ? "Hide compare" : "Compare"}
          </Button>
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="whitespace-pre-line rounded-xl border border-approve/20 bg-approve-soft/20 px-5 py-4 text-[15px] leading-relaxed text-ink">
          {correctedText}
        </div>

        {compare && originalText && (
          <div className="mt-5 border-t border-line pt-5">
            <ComparisonView original={originalText} corrected={correctedText} />
          </div>
        )}
      </div>
    </section>
  );
}