import { toJpeg, toPng } from "html-to-image";

/**
 * Download/export layer for the recreated post.
 *
 * The renderer exposes a full-resolution, offscreen copy of the post
 * (see components/recreate-preview.tsx) and that node is what gets
 * rasterized here — so exports are always the true canvas size
 * (e.g. 1080 × 1350), never the scaled-down preview.
 *
 * Adding a new format later (e.g. PDF) is a registry entry plus a
 * branch in exportElement() — no call sites change.
 */

export type ExportFormatId = "png" | "jpg";

export interface ExportFormatOption {
  id: ExportFormatId;
  label: string;
  extension: string;
  mime: string;
}

export const EXPORT_FORMATS: ExportFormatOption[] = [
  { id: "png", label: "PNG", extension: "png", mime: "image/png" },
  { id: "jpg", label: "JPG", extension: "jpg", mime: "image/jpeg" },
];

export function getExportFormat(id: ExportFormatId): ExportFormatOption {
  return EXPORT_FORMATS.find((format) => format.id === id) ?? EXPORT_FORMATS[0];
}

export interface ExportOptions {
  /** Used for JPG (JPEG has no alpha) and as a PNG safety background. */
  backgroundColor?: string;
}

export async function exportElement(
  node: HTMLElement,
  formatId: ExportFormatId,
  options: ExportOptions = {}
): Promise<Blob> {
  const format = getExportFormat(formatId);

  const dataUrl =
    formatId === "jpg"
      ? await toJpeg(node, {
          quality: 0.95,
          pixelRatio: 1,
          backgroundColor: options.backgroundColor ?? "#FFFFFF",
          cacheBust: false,
        })
      : await toPng(node, {
          pixelRatio: 1,
          backgroundColor: options.backgroundColor,
          cacheBust: false,
        });

  const response = await fetch(dataUrl);
  return response.blob();
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildExportFilename(
  formatId: string,
  extension: string,
  width: number,
  height: number
): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `recreated-post-${formatId}-${width}x${height}-${stamp}.${extension}`;
}
