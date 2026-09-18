import { RotateCcw, ImageOff, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  message: string;
  /** Shown under the message — set false to hide (e.g. when no image was kept, like demo mode). */
  reassurance?: boolean;
  onRetry?: () => void;
  onChooseAnother?: () => void;
}

export function ErrorState({
  title = "AI service is temporarily busy",
  message,
  reassurance = true,
  onRetry,
  onChooseAnother,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-card border border-flag/30 bg-flag-soft/40 px-6 py-14 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface">
        <TriangleAlert className="h-6 w-6 text-flag" aria-hidden="true" />
      </span>
      <div>
        <p className="font-serif text-lg text-ink">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-ink-soft">{message}</p>
        {reassurance && (
          <p className="mt-1 max-w-sm text-sm text-ink-faint">
            Your uploaded design is safe and hasn't been changed.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        )}
        {onChooseAnother && (
          <Button variant="secondary" size="sm" onClick={onChooseAnother}>
            <ImageOff className="h-4 w-4" aria-hidden="true" />
            Choose another image
          </Button>
        )}
      </div>
    </div>
  );
}
