import type { CopyReview as CopyReviewType } from "@/lib/types";

interface CopyReviewProps {
  review: CopyReviewType;
}

const rows: { key: keyof Omit<CopyReviewType, "overall">; label: string }[] = [
  { key: "hook", label: "Hook" },
  { key: "clarity", label: "Clarity" },
  { key: "valueProposition", label: "Value proposition" },
  { key: "cta", label: "Call to action" },
  { key: "readability", label: "Readability" },
  { key: "conciseness", label: "Conciseness" },
  { key: "tone", label: "Tone" },
];

export function CopyReview({ review }: CopyReviewProps) {
  return (
    <section aria-labelledby="copy-review-heading" className="rounded-card border border-line bg-surface p-6">
      <h2 id="copy-review-heading" className="font-serif text-lg text-ink">
        Social media copy review
      </h2>
      <p className="mt-1 text-sm text-ink-soft">{review.overall}</p>

      <dl className="mt-5 divide-y divide-line border-t border-line">
        {rows.map(({ key, label }) => (
          <div key={key} className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
            <dt className="text-sm font-medium text-ink">{label}</dt>
            <dd className="text-sm leading-relaxed text-ink-soft">{review[key]}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
