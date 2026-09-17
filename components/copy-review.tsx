import type { CopyReview as CopyReviewType } from "@/lib/types";

interface CopyReviewProps {
  review: CopyReviewType;
}

const items: { key: keyof Omit<CopyReviewType, "overall">; label: string }[] = [
  { key: "hook", label: "Hook" },
  { key: "clarity", label: "Clarity" },
  { key: "valueProposition", label: "Value Proposition" },
  { key: "cta", label: "CTA" },
  { key: "readability", label: "Readability" },
  { key: "conciseness", label: "Conciseness" },
  { key: "tone", label: "Tone" },
];

export function CopyReview({ review }: CopyReviewProps) {
  return (
    <section aria-labelledby="copy-review-heading" className="animate-fade-up">
      <div className="mb-4">
        <h2 id="copy-review-heading" className="text-base font-semibold tracking-tight text-ink">
          Marketing Copy Review
        </h2>
        <p className="mt-0.5 text-xs text-ink-faint">
          The AI's take on the effectiveness of your copy.
        </p>
      </div>

      <div className="rounded-panel border border-line bg-surface p-5 shadow-soft">
        <p className="rounded-xl bg-paper-dim/40 px-4 py-3 text-sm leading-relaxed text-ink">
          <span className="font-semibold">Overall · </span>
          {review.overall}
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ key, label }) => (
            <article key={key} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                {label}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{review[key]}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}