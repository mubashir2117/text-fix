import { CopyButton } from "@/components/copy-button";

interface ExtractedTextProps {
  text: string;
  ocrConfidence: number;
}

export function ExtractedText({ text, ocrConfidence }: ExtractedTextProps) {
  const lowConfidence = ocrConfidence < 0.75;

  return (
    <section aria-labelledby="extracted-text-heading" className="rounded-card border border-line bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 id="extracted-text-heading" className="font-serif text-lg text-ink">
          Extracted text
        </h2>
        <CopyButton text={text} />
      </div>

      <blockquote className="mt-4 border-l-2 border-line pl-4 font-serif text-lg italic leading-relaxed text-ink-soft">
        "{text}"
      </blockquote>

      {lowConfidence && (
        <p className="mt-4 flex items-start gap-2 rounded-[6px] bg-flag-soft px-3 py-2 text-sm text-flag">
          Some text may have been interpreted incorrectly. Please verify against the original image.
        </p>
      )}
    </section>
  );
}
