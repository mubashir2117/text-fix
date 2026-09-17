"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenLine, Settings, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink text-paper transition-colors group-hover:bg-pen">
            <PenLine className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[15px] font-semibold tracking-tight text-ink">
              AI Text Fixer
            </span>
            <span className="hidden text-xs text-ink-faint sm:block">
              AI-powered social media copy checker
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/history"
            className={cn(
              "hidden items-center rounded-lg px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:bg-paper-dim/70 hover:text-ink md:inline-flex",
              pathname === "/history" && "text-ink"
            )}
          >
            History
          </Link>
          <button
            type="button"
            aria-label="Settings"
            onClick={() => toast.info("Settings are on the way. Hang tight!")}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-paper-dim/70 hover:text-ink"
          >
            <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <Link
            href="/analyze"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-sm font-medium text-paper transition-colors hover:bg-[#2F2E2A]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New Analysis
          </Link>
        </div>
      </div>
    </header>
  );
}