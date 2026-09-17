import type { AnalysisResult, HistoryEntry } from "./types";

const STORAGE_KEY = "ai-text-fixer:history";
const MAX_ENTRIES = 24;

/**
 * History is stored client-side in localStorage for now. The shape here
 * (HistoryEntry[]) is intentionally simple so it can be swapped for a
 * database-backed API (e.g. Supabase) later without changing callers.
 */
export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: {
  fileName: string;
  thumbnailDataUrl: string;
  result: AnalysisResult;
}): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getHistory();
    const newEntry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...entry,
    };
    const updated = [newEntry, ...existing].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Storage may be unavailable (e.g. private browsing) — fail silently,
    // history is a convenience feature, not critical path.
  }
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
