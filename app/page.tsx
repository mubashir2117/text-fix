import Link from "next/link";
import { SpellCheck, PencilLine, Sparkles, Megaphone, Upload, ScanText, ListChecks, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroAnnotation } from "@/components/hero-annotation";

const featureCards = [
  {
    icon: SpellCheck,
    title: "Grammar check",
    description: "Find grammar and sentence-structure issues before your audience does.",
  },
  {
    icon: PencilLine,
    title: "Spelling check",
    description: "Detect spelling mistakes and typos hiding in the design.",
  },
  {
    icon: Sparkles,
    title: "Copy improvement",
    description: "Improve clarity and flow without changing what you meant to say.",
  },
  {
    icon: Megaphone,
    title: "Marketing review",
    description: "Review hooks, CTAs, readability, and overall messaging.",
  },
];

const workflowSteps = [
  { icon: Upload, label: "Upload design" },
  { icon: ScanText, label: "AI reads text" },
  { icon: ListChecks, label: "Finds issues" },
  { icon: FileCheck2, label: "Corrected copy" },
];

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h1 className="font-serif text-4xl leading-[1.1] text-ink sm:text-5xl">
              Fix your social media copy before you post.
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
              Upload your design. AI reads the text, finds mistakes, and gives you a
              corrected version — in the time it takes to make coffee.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/analyze">
                <Button size="lg">Upload your design</Button>
              </Link>
              <Link href="/analyze?paste=1">
                <Button size="lg" variant="secondary">
                  Paste screenshot
                </Button>
              </Link>
              <Link href="/analyze?demo=1" className="text-sm font-medium text-ink-soft underline-offset-4 hover:text-ink hover:underline">
                or try an example
              </Link>
            </div>
          </div>

          <HeroAnnotation />
        </div>
      </section>

      <section aria-labelledby="workflow-heading" className="border-y border-line bg-paper-dim/40">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
          <h2 id="workflow-heading" className="sr-only">
            How it works
          </h2>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div key={step.label} className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-sm font-medium text-ink">
                  {index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <step.icon className="hidden h-4 w-4 text-ink-faint sm:block" aria-hidden="true" />
                  <p className="text-sm font-medium text-ink">{step.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
        <h2 id="features-heading" className="font-serif text-3xl text-ink">
          What AI Text Fixer checks
        </h2>
        <p className="mt-2 max-w-lg text-ink-soft">
          A full read of the copy on your design, not just a spellcheck pass.
        </p>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card) => (
            <div key={card.title} className="rounded-card border border-line bg-surface p-6">
              <card.icon className="h-5 w-5 text-pen" aria-hidden="true" />
              <p className="mt-4 font-serif text-lg text-ink">{card.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{card.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-16 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <p className="font-serif text-2xl text-paper">Ready to check your next post?</p>
            <p className="mt-2 max-w-md text-paper/70">
              Upload a design and get a full text report in under a minute.
            </p>
          </div>
          <Link href="/analyze">
            <Button size="lg" className="bg-paper text-ink hover:bg-pen hover:text-paper">
              Upload your design
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
