import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "correct":
      return "Text looks good";
    case "needs_improvement":
      return "Needs improvement";
    case "incorrect":
      return "Needs correction";
    default:
      return status;
  }
}

export function severityWeight(severity: string): number {
  switch (severity) {
    case "critical":
      return 0;
    case "high":
      return 1;
    case "medium":
      return 2;
    case "low":
      return 3;
    default:
      return 4;
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Maps an API error payload to the message shown in the UI. Server
 * messages are already user-friendly; the missing-API-key case is
 * translated to the approved administrator message, and raw/internal
 * error details are never surfaced.
 */
export function friendlyApiErrorMessage(payload: unknown, fallback: string): string {
  const data = payload as { error?: unknown; code?: unknown } | null | undefined;
  if (data?.code === "missing_api_key") {
    return "AI service is not configured. Please contact the administrator.";
  }
  if (typeof data?.error === "string" && data.error.trim().length > 0) {
    return data.error.trim();
  }
  return fallback;
}
