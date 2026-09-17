import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "ink" | "pen" | "approve" | "flag" | "muted";
}

const toneClasses: Record<NonNullable<BadgeProps["tone"]>, string> = {
  ink: "bg-ink text-paper",
  pen: "bg-pen-soft text-pen",
  approve: "bg-approve-soft text-approve",
  flag: "bg-flag-soft text-flag",
  muted: "bg-paper-dim text-ink-soft",
};

export function Badge({ className, tone = "muted", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
