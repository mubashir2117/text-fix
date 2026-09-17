"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateImageFile } from "@/lib/validation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface UploadZoneProps {
  onFileSelected: (file: File) => void;
}

export function UploadZone({ onFileSelected }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      const file = fileList?.[0];
      if (!file) return;
      const validation = validateImageFile(file);
      if (!validation.valid) {
        toast.error(validation.error);
        return;
      }
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload your design. Drag and drop an image, or press Enter to browse files."
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "group relative flex min-h-[320px] cursor-pointer flex-col items-center justify-center gap-5 rounded-panel border-2 border-dashed bg-surface px-6 py-16 text-center outline-none transition-all duration-200",
        isDragging
          ? "border-ink-faint bg-paper-dim/60"
          : "border-line hover:border-ink-faint/70 hover:bg-paper-dim/30"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div
        className={cn(
          "pointer-events-none flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-paper transition-all duration-200",
          isDragging && "scale-105 border-ink-faint bg-surface"
        )}
        aria-hidden="true"
      >
        <UploadCloud className="h-7 w-7 text-ink-soft" />
      </div>

      <div className="pointer-events-none space-y-1.5">
        <p className="text-lg font-semibold tracking-tight text-ink">Drop your design here</p>
        <p className="text-sm text-ink-soft">or click to browse</p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          openPicker();
        }}
      >
        <ImagePlus className="h-4 w-4" aria-hidden="true" />
        Upload Design
      </Button>

      <p id="upload-hint" className="pointer-events-none text-xs text-ink-faint">
        JPG, PNG or WEBP · Max file size supported
      </p>
    </div>
  );
}