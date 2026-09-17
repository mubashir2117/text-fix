export function HeroAnnotation() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="rounded-card border border-line bg-surface p-5 shadow-desk">
        <div className="flex items-center gap-2 border-b border-line pb-3">
          <div className="h-8 w-8 rounded-full bg-paper-dim" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-ink">brightpath.io</p>
            <p className="text-xs text-ink-faint">Sponsored</p>
          </div>
        </div>

        <div className="mt-4 aspect-square w-full rounded-[6px] bg-gradient-to-br from-[#1B3A4B] to-[#0E2430] p-6">
          <p className="font-serif text-2xl leading-snug text-white">
            Grow your business{" "}
            <span className="relative inline-block">
              <span className="text-white/50 line-through decoration-pen decoration-2">with right solution</span>
            </span>
            .
          </p>
          <span className="mt-3 inline-block rounded-full bg-[#5FA8C7] px-4 py-2 text-sm font-medium text-[#0E2430]">
            Get started Today
          </span>
        </div>
      </div>

      <div className="absolute -right-4 top-1/3 w-48 rotate-2 rounded-[6px] border border-pen/30 bg-pen-soft px-3 py-2.5 shadow-desk sm:-right-10">
        <p className="text-xs font-medium text-pen">Missing article</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">
          Add "the" before "right solution."
        </p>
      </div>
    </div>
  );
}
