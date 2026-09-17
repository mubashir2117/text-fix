import { CopyButton } from "@/components/copy-button";

interface CorrectionCardProps {
  correctedText: string;
}

export function CorrectionCard({ correctedText }: CorrectionCardProps) {
  return (
    <section
      aria-labelledby="recommended-copy-heading"
      className="rounded-card border border-approve/30 bg-approve-soft/50 p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="recommended-copy-heading" className="font-serif text-lg text-ink">
            Recommended copy
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Meaning preserved — brand names, prices, and links untouched.</p>
        </div>
        <CopyButton text={correctedText} label="Copy corrected text" variant="primary" />
      </div>

      <p className="mt-4 rounded-[6px] bg-surface p-4 font-serif text-lg leading-relaxed text-ink">
        {correctedText}
      </p>
    </section>
  );
}
