import { NextResponse } from "next/server";
import {
  ApiError,
  apiError,
  apiStatusForCode,
  ERROR_MESSAGES,
  type ApiErrorCode,
  type ApiErrorPayload,
} from "./errors";

// Fail fast if this module ever ends up in a browser bundle: it builds
// HTTP responses for server route handlers only.
if (typeof window !== "undefined") {
  throw new Error("lib/api-response.ts is server-only and must not be imported by client code.");
}

/**
 * ---------------------------------------------------------------------
 * Shared API response helpers (server-only)
 * ---------------------------------------------------------------------
 *
 * Every failure is serialized as the single documented contract:
 *   { "success": false, "error": { "code": "...", "message": "..." } }
 * with an HTTP status derived from `code` (see apiStatusForCode).
 */

export interface ApiFailure {
  payload: ApiErrorPayload;
  status: number;
  code: ApiErrorCode;
}

/** Maps any thrown error onto the structured error contract. */
export function apiFailureFrom(err: unknown): ApiFailure {
  if (err instanceof ApiError) {
    // Server-side logging only: code + user-safe message, never the key,
    // the image payload, or raw provider credentials.
    console.error(`[api] ${err.name}: ${err.code} — ${err.message}`);
    return {
      payload: apiError(err.code, err.message),
      status: apiStatusForCode(err.code),
      code: err.code,
    };
  }
  console.error("[api] Unhandled error:", err);
  return apiFailure("UNEXPECTED_ERROR");
}

export function apiFailure(code: ApiErrorCode, message?: string): ApiFailure {
  return {
    payload: apiError(code, message ?? ERROR_MESSAGES[code]),
    status: apiStatusForCode(code),
    code,
  };
}

export function jsonFailure(failure: ApiFailure): NextResponse {
  return NextResponse.json(failure.payload, { status: failure.status });
}

export function jsonSuccess<T>(result: T): NextResponse {
  return NextResponse.json({ success: true, result });
}

// --- Server-sent events ------------------------------------------------------

export type SseEmitter = (event: string, data: unknown) => void;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disable proxy buffering so progress events flush immediately.
  "X-Accel-Buffering": "no",
};

/**
 * Wraps an async task in a text/event-stream response.
 *
 * Events:
 *   progress — { retry, maxRetries, code, message, delayMs } before each retry
 *   result   — { success: true, result } on success
 *   error    — { success: false, error: { code, message }, status } on failure
 *
 * Used by the analyze/recreate routes so the UI can show live
 * "Retry attempt N/4" states while the server retries transient errors.
 */
export function sseResponse(run: (emit: SseEmitter) => Promise<void>): Response {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit: SseEmitter = (event, data) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true; // client went away
        }
      };

      try {
        await run(emit);
      } catch (err) {
        const failure = apiFailureFrom(err);
        emit("error", { ...failure.payload, status: failure.status });
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed / cancelled
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
