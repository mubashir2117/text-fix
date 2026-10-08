import { apiError, type ApiProgressEvent } from "./errors";

/**
 * ---------------------------------------------------------------------
 * Client API helper with retry-progress streaming
 * ---------------------------------------------------------------------
 *
 * The analyze/recreate routes accept `stream=1` in the form payload and
 * answer with `text/event-stream`:
 *
 *   event: progress — { retry, maxRetries, code, message, delayMs }
 *   event: result   — { success: true, result, ... }
 *   event: error    — { success: false, error: { code, message }, status }
 *
 * If the response is not an event stream (validation failure, proxy that
 * buffers, older deployment), the JSON body is parsed directly — both
 * shapes are surfaced through the same `ApiResponse`.
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
}

export interface PostFormOptions {
  /** Called before each server-side Gemini retry ("Retry attempt N/4"). */
  onProgress?: (event: ApiProgressEvent) => void;
  signal?: AbortSignal;
}

function readEventStream(response: Response, onProgress?: PostFormOptions["onProgress"]): Promise<ApiResponse> {
  return new Promise<ApiResponse>((resolve, reject) => {
    const reader = response.body?.getReader();
    if (!reader) {
      response
        .json()
        .then((data) => resolve({ ok: response.ok, status: response.status, data }))
        .catch(() => reject(new Error("The connection was interrupted. Please try again.")));
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    const handleBlock = (block: string): ApiResponse | null => {
      let event = "message";
      let dataLine = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLine += line.slice(5).trim();
      }
      if (!dataLine) return null;

      let payload: any;
      try {
        payload = JSON.parse(dataLine);
      } catch {
        return null;
      }

      if (event === "progress") {
        try {
          onProgress?.(payload as ApiProgressEvent);
        } catch {
          // a broken progress callback must never break the request
        }
        return null;
      }

      if (event === "result") {
        return { ok: true, status: 200, data: payload };
      }

      if (event === "error") {
        return {
          ok: false,
          status: typeof payload?.status === "number" ? payload.status : 502,
          data: payload,
        };
      }

      return null;
    };

    const pump = async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const terminal = handleBlock(block);
          if (terminal) {
            try {
              await reader.cancel();
            } catch {
              // already closed
            }
            resolve(terminal);
            return;
          }

          boundary = buffer.indexOf("\n\n");
        }
      }

      // Stream ended without a terminal event.
      resolve({
        ok: false,
        status: 502,
        data: apiError(
          "UNEXPECTED_ERROR",
          "The connection was interrupted while waiting for the AI service. Please try again."
        ),
      });
    };

    pump().catch(reject);
  });
}

/**
 * POSTs a FormData payload to an API route and returns a normalized
 * result, transparently handling the streaming retry-progress protocol.
 * Network failures reject (callers treat that as a connection problem).
 */
export async function postForm<T = any>(
  url: string,
  formData: FormData,
  options?: PostFormOptions
): Promise<ApiResponse<T>> {
  formData.set("stream", "1");

  const response = await fetch(url, {
    method: "POST",
    body: formData,
    headers: { Accept: "text/event-stream" },
    signal: options?.signal,
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) {
    return readEventStream(response, options?.onProgress);
  }

  const data = (await response.json().catch(() => null)) as T | null;
  return { ok: response.ok && data !== null, status: response.status, data };
}
