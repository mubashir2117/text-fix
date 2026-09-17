import { TriangleAlert } from "lucide-react";
import { CopyButton } from "@/components/copy-button";

interface ExtractedTextProps {
  text: string;
  ocrConfidence: number;
}

export function ExtractedText({ text, ocrConfidence }: ExtractedTextProps) {
  const lowConfidence = ocrConfidence < 0.75;

  return (
    <section
      aria-labelledby="extracted-text-heading"
      className="rounded-panel border border-line bg-surface p-6 shadow-soft animate-fade-up"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="extracted-text-heading" className="text-base font-semibold tracking-tight text-ink">
            Extracted Text
          </h2>
          <p className="mt-0.5 text-xs text-ink-faint">
            Text detected from your design, exactly as read.
          </p>
        </div>
        <CopyButton text={text} label="Copy Text" />
      </div>

      <div className="mt-4 whitespace-pre-line rounded-xl border border-line bg-paper-dim/40 px-5 py-4 text-[15px] leading-relaxed text-ink">
        {text || "No text to display."}
      </div>

      {lowConfidence && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-flag-soft px-4 py-3 text-sm text-flag">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Some text may have been interpreted incorrectly. Please verify against the original image.
        </p>
      )}
    </section>
  );
}