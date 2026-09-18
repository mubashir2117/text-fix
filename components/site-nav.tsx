"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PenLine } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/analyze", label: "Analyze" },
  { href: "/history", label: "History" },
  { href: "/#about", label: "About" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <PenLine className="h-5 w-5 text-pen" strokeWidth={2.25} aria-hidden="true" />
          <span className="font-serif text-lg font-medium tracking-tight">AI Text Fixer</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "text-[15px] text-ink-soft transition-colors hover:text-ink",
                  active && "text-ink"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/analyze"
          className="rounded-card bg-ink px-4 py-2 text-sm font-medium text-paper transition-colors hover:bg-pen"
        >
          Upload design
        </Link>
      </div>
    </header>
  );
}
