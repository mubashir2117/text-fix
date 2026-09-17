"use client";

import { useEffect } from "react";
import { Clipboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { validateImageFile } from "@/lib/validation";

/**
 * Listens for a native paste event anywhere on the page and, if the
 * clipboard contains an image, converts it into a File and hands it to
 * onImage — the same shape a drag-and-drop or file-picker upload
 * produces, so callers don't need a separate code path for it.
 *
 * Pass `enabled: false` to stop listening (e.g. once an image is
 * already selected, so a stray paste elsewhere on the page doesn't
 * silently replace it).
 */
export function useClipboardPaste(onImage: (file: File) => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    function handlePaste(event: ClipboardEvent) {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) continue;

          const validation = validateImageFile(file);
          if (!validation.valid) {
            toast.error(validation.error);
            return;
          }

          event.preventDefault();
          toast.success("Screenshot pasted ✓");
          onImage(file);
          return;
        }
      }
    }

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [onImage, enabled]);
}

interface PasteScreenshotButtonProps {
  onImage: (file: File) => void;
  className?: string;
}

/**
 * A secondary "Paste Screenshot" button. Most browsers require a user
 * gesture (and, for Chrome, a clipboard-read permission grant) before
 * JavaScript can read image data directly — when that's not available,
 * this falls back to telling the person to press Ctrl+V / Cmd+V, which
 * the useClipboardPaste listener above will pick up regardless.
 */
export function PasteScreenshotButton({ onImage, className }: PasteScreenshotButtonProps) {
  async function handleClick() {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      toast.info("Press Ctrl+V (or Cmd+V on Mac) to paste your screenshot.");
      return;
    }

    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;

        const blob = await item.getType(imageType);
        const file = new File([blob], `pasted-screenshot.${imageType.split("/")[1] || "png"}`, { type: imageType });

        const validation = validateImageFile(file);
        if (!validation.valid) {
          toast.error(validation.error);
          return;
        }

        toast.success("Screenshot pasted ✓");
        onImage(file);
        return;
      }
      toast.info("No image found on your clipboard. Copy a screenshot, then try again — or press Ctrl+V.");
    } catch {
      toast.info("Press Ctrl+V (or Cmd+V on Mac) to paste your screenshot.");
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={handleClick} className={className}>
      <Clipboard className="h-4 w-4" aria-hidden="true" />
      Paste screenshot
    </Button>
  );
}
