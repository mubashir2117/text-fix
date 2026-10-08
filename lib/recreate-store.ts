import type { RecreateSelection } from "./types";

/**
 * In-memory handoff of the uploaded file from the shared upload page
 * (/analyze) to /recreate when the user picks "Recreate Post".
 *
 * Deliberately module-scoped and ephemeral: nothing is persisted, so it
 * fits Vercel's serverless/static model — no localStorage, no cookies,
 * no server state. If someone opens /recreate directly (or refreshes),
 * the page simply shows its own upload dropzone.
 */

interface PendingPost {
  file: File;
  previewUrl: string;
  selection?: RecreateSelection;
}

let pending: PendingPost | null = null;

export function setPendingPost(post: PendingPost): void {
  pending = post;
}

export function takePendingPost(): PendingPost | null {
  const current = pending;
  pending = null;
  return current;
}
