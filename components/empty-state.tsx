import { FileSearch } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-dashed border-line px-6 py-16 text-center">
      <FileSearch className="h-8 w-8 text-ink-faint" aria-hidden="true" />
      <div>
        <p className="font-serif text-lg text-ink">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">{description}</p>
      </div>
      {action}
    </div>
  );
}
