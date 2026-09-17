"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, ImageUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { validateImageFile } from "@/lib/validation";
import { toast } from "sonner";

interface UploadDropzoneProps {
  onFileSelected: (file: File) => void;
}

export function UploadDropzone({ onFileSelected }: UploadDropzoneProps) {
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

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload your design. Drag and drop an image, or press Enter to browse files."
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
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
        "group relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-4 rounded-card border-2 border-dashed border-line bg-surface px-6 py-14 text-center transition-colors",
        isDragging ? "border-pen bg-pen-soft/40" : "hover:border-ink-faint"
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
          "flex h-14 w-14 items-center justify-center rounded-full border border-line bg-paper transition-transform",
          isDragging && "scale-110 border-pen"
        )}
        aria-hidden="true"
      >
        {isDragging ? <ImageUp className="h-6 w-6 text-pen" /> : <UploadCloud className="h-6 w-6 text-ink-soft" />}
      </div>
      <div>
        <p className="font-serif text-xl text-ink">Upload your design</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">
          Drag and drop a post, ad, banner, or screenshot — or click to browse.
        </p>
      </div>
      <p className="text-xs text-ink-faint">JPG, PNG, or WEBP · up to 10MB</p>
    </div>
  );
}
