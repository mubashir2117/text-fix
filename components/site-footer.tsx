export function SiteFooter() {
  return (
    <footer id="about" className="border-t border-line">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-serif text-base text-ink">AI Text Fixer</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
              A copy desk for your social posts. Upload a design, and AI reads the text
              the way a careful editor would — before your audience does.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">What it checks</p>
            <ul className="mt-2 space-y-1 text-sm text-ink-soft">
              <li>Spelling &amp; grammar</li>
              <li>Punctuation &amp; capitalization</li>
              <li>Clarity &amp; readability</li>
              <li>Hooks, CTAs &amp; tone</li>
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-ink">Good to know</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Every result is an AI-generated read of your image, not a guarantee. Always
              give the corrected copy a final human look before you publish.
            </p>
          </div>
        </div>
        <p className="mt-10 text-xs text-ink-faint">
          Built with Next.js. Deployed on Vercel.
        </p>
      </div>
    </footer>
  );
}
