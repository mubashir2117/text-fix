import { RotateCcw, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-card border border-pen/30 bg-pen-soft/40 px-6 py-14 text-center"
    >
      <CircleAlert className="h-8 w-8 text-pen" aria-hidden="true" />
      <div>
        <p className="font-serif text-lg text-ink">We hit a snag</p>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  );
}
