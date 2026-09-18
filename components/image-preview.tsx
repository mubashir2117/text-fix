import { cn } from "@/lib/utils";

interface ImagePreviewProps {
  src: string;
  alt?: string;
  className?: string;
}

export function ImagePreview({ src, alt = "Uploaded design preview", className }: ImagePreviewProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card border border-line bg-surface p-2 shadow-desk",
        className
      )}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[6px] bg-paper-dim sm:aspect-[4/3]">
        {/* Using a plain img since the source is a client-generated object/data URL. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="h-full w-full object-contain" />
      </div>
    </div>
  );
}
