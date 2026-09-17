"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  variant?: "primary" | "secondary" | "ghost" | "outline";
}

export function CopyButton({ text, label = "Copy text", className, variant = "secondary" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={handleClick}
      className={cn(className)}
      aria-live="polite"
    >
      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
