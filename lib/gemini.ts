import type { ZodType, ZodTypeDef } from "zod";
import {
  ApiError,
  ERROR_MESSAGES,
  RETRY_MESSAGES,
  type ApiProgressEvent,
  type GeminiErrorCode,
} from "./errors";

// Fail fast if this module ever ends up in a browser bundle: the Gemini
// API key must only ever be read from server-side environment variables
// (spec §39 — never expose it in React components, client JS, or
// NEXT_PUBLIC_* variables).
if (typeof window !== "undefined") {
  throw new Error("lib/gemini.ts is server-only and must not be imported by client code.");
}

/**
 * ---------------------------------------------------------------------
 * Reusable server-side Gemini utility
 * ---------------------------------------------------------------------
 *
 *   Route Handler (app/api/analyze, app/api/recreate, ...)
 *           |
 *           v
 *   lib/gemini.ts  (this file)  — key collection, retry/backoff, key
 *           |                     failover, model failover, JSON parsing
 *           v
 *   Google Gemini API
 *           |
 *           v
 *   Zod validation  ->  typed result back to the Route Handler
 *
 * IMPORTANT: this module must only ever run on the server. The Gemini
 * API key is read from server-side environment variables
 * (GEMINI_API_KEY / GEMINI_API_KEY_1..5) and is never sent to the
 * browser. Do NOT create a NEXT_PUBLIC_ variant of these variables.
 *
 * Error contract: every failure surfaces as a GeminiError carrying a
 * machine-readable `code` (see GeminiErrorCode in lib/errors.ts) and a
 * user-safe `message`. The API routes serialize this as:
 *   { success: false, error: { code, message } }
 */

// --- Errors ---------------------------------------------------------------

/**
 * Thrown for any Gemini-side failure: missing keys, invalid/expired keys,
 * rate limits, timeouts, network failures, unknown model, or an
 * invalid/malformed response. Messages are safe to show to end users and
 * to log — they never contain the API key, image payload, or raw
 * provider credentials.
 */
export class GeminiError extends ApiError {
  readonly code: GeminiErrorCode;
  readonly status?: number;

  constructor(message: string, code: GeminiErrorCode, cause?: unknown, status?: number) {
    super(message, code, cause);
    this.name = "GeminiError";
    this.code = code;
    this.status = status;
  }
}

/** Raised when no server-side Gemini key is configured at all. */
export class GeminiNotConfiguredError extends GeminiError {
  constructor(message: string = ERROR_MESSAGES.MISSING_GEMINI_API_KEY) {
    super(message, "MISSING_GEMINI_API_KEY");
    this.name = "GeminiNotConfiguredError";
  }
}

// --- Server-side configuration --------------------------------------------

export interface ConfiguredKey {
  key: string;
  /** Safe-to-log identifier, e.g. "key-1". Never log the raw key value. */
  label: string;
}

/**
 * Collects every configured Gemini key from the server environment.
 *
 * Supported variables (all server-side only):
 *   - GEMINI_API_KEY       — single primary key (documented in README)
 *   - GEMINI_API_KEY_1..5  — ordered multi-key failover list
 *
 * Empty/whitespace values are ignored.
 */
export function getGeminiKeys(): ConfiguredKey[] {
  const entries: { name: string; key: string | undefined }[] = [
    { name: "GEMINI_API_KEY", key: process.env.GEMINI_API_KEY },
    { name: "GEMINI_API_KEY_1", key: process.env.GEMINI_API_KEY_1 },
    { name: "GEMINI_API_KEY_2", key: process.env.GEMINI_API_KEY_2 },
    { name: "GEMINI_API_KEY_3", key: process.env.GEMINI_API_KEY_3 },
    { name: "GEMINI_API_KEY_4", key: process.env.GEMINI_API_KEY_4 },
    { name: "GEMINI_API_KEY_5", key: process.env.GEMINI_API_KEY_5 },
  ];

  return entries
    .filter((entry) => entry.key && entry.key.trim().length > 0)
    .map((entry, index) => ({ key: entry.key!.trim(), label: `key-${index + 1}` }));
}

/** True when at least one server-side Gemini key is configured. */
export function hasGeminiKey(): boolean {
  return getGeminiKeys().length > 0;
}

/**
 * The model to use. Configurable through GEMINI_MODEL; falls back to a
 * documented supported default so no model name is hardcoded in a way
 * that can't be changed without a redeploy.
 */
export function getGeminiModel(): string {
  return (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim()) || "gemini-3.6-flash";
}

/** Optional — tried only after every key has failed against GEMINI_MODEL with a non-fatal error. */
export function getGeminiFallbackModel(): string | undefined {
  const value = process.env.GEMINI_MODEL_FALLBACK?.trim();
  return value ? value : undefined;
}

// --- Logging (never logs key values or image data) --------------------------

function log(message: string) {
  console.log(`[Gemini] ${message}`);
}

function logError(message: string) {
  console.error(`[Gemini] ${message}`);
}

/**
 * Failure block for Vercel Function Logs (spec §4 — safe production
 * logging). Logs only the HTTP status, the model name, the error code
 * and a safe message: NEVER the API key, the image payload, or raw
 * provider credentials.
 */
function logGeminiError(
  model: string,
  status: number | "n/a" | "final",
  code: GeminiErrorCode,
  message: string
) {
  console.error(
    `[GEMINI ERROR]\nstatus: ${status}\nmodel: ${model}\ncode: ${code}\nmessage: ${message}`
  );
}

// --- Retry / backoff configuration ------------------------------------------

/** Transient statuses are retried with exponential backoff, up to 4 times. */
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
/** Never retried: 400 / 401 / 403 / 404 (and any other unexpected status). */
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s, 8s
const BACKOFF_JITTER = 0.25; // +/- 25%
const MAX_RETRY_DELAY_MS = 15_000;
const REQUEST_TIMEOUT_MS = 25_000;
/** Whole-request budget so retries always fit inside `maxDuration = 60`. */
const TOTAL_BUDGET_MS = 52_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Jittered exponential backoff: attempt 1 -> ~1s, 2 -> ~2s, 3 -> ~4s, 4 -> ~8s.
 * Jitter keeps parallel requests from retrying in lockstep.
 */
function backoffDelayMs(retryIndex: number, retryAfterMs?: number): number {
  const base = BACKOFF_BASE_MS * 2 ** (retryIndex - 1);
  const jitter = 1 + (Math.random() * 2 - 1) * BACKOFF_JITTER;
  const delay = Math.round(base * jitter);
  const withRetryAfter = retryAfterMs && retryAfterMs > delay ? retryAfterMs : delay;
  return Math.min(withRetryAfter, MAX_RETRY_DELAY_MS);
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} seconds`;
}

// --- Error classification ----------------------------------------------------

type ErrorClass =
  | "retry" // transient — worth retrying this same key with backoff
  | "failover" // don't waste retries on this key — move to the next one
  | "fatal"; // not key-specific — retrying with another key won't help

interface ClassifiedError {
  errorClass: ErrorClass;
  code: GeminiErrorCode;
  /** Log-safe detail (never shown to users). */
  detail: string;
  retryAfterMs?: number;
  status?: number;
}

function classifyHttpError(
  status: number,
  body: string,
  retryAfterHeader: string | null
): ClassifiedError {
  const detail = body.slice(0, 300);

  // 400 — malformed request. Retrying the same request changes nothing.
  if (status === 400) {
    return { errorClass: "failover", code: "GEMINI_BAD_REQUEST", detail: `Gemini returned 400: ${detail}`, status };
  }

  // 401 — this specific key is invalid/revoked. No point retrying it, but a
  // different key/project may still work, so fail over rather than loop.
  if (status === 401) {
    return {
      errorClass: "failover",
      code: "GEMINI_AUTH_FAILED",
      detail: "Gemini returned 401 (invalid or unauthorized API key).",
      status,
    };
  }

  // 403 — key is valid but not allowed for this model/project.
  if (status === 403) {
    return {
      errorClass: "failover",
      code: "GEMINI_ACCESS_DENIED",
      detail: `Gemini returned 403: ${detail}`,
      status,
    };
  }

  // 404 — wrong/unavailable model name. Every key shares the same model,
  // so rotating keys will not fix this; surface it as a config problem.
  if (status === 404) {
    return {
      errorClass: "fatal",
      code: "GEMINI_MODEL_NOT_FOUND",
      detail:
        "Gemini model not found (404). Check the GEMINI_MODEL environment variable — current value may not exist or may not be available to your account's API version.",
      status,
    };
  }

  // 408 — request timeout: transient, retry with backoff.
  if (status === 408) {
    return { errorClass: "retry", code: "GEMINI_TIMEOUT", detail: "Gemini returned 408 (request timeout).", status };
  }

  // 429 — rate limited / quota exhausted. Respect Retry-After if sent.
  if (status === 429) {
    const parsed = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    return {
      errorClass: "retry",
      code: "GEMINI_RATE_LIMITED",
      detail: "Gemini returned 429 (RESOURCE_EXHAUSTED).",
      retryAfterMs: parsed && !Number.isNaN(parsed) ? parsed : undefined,
      status,
    };
  }

  // 504 — gateway timeout: treated as a timeout, not a generic outage.
  if (status === 504) {
    return { errorClass: "retry", code: "GEMINI_TIMEOUT", detail: "Gemini returned 504 (gateway timeout).", status };
  }

  // 503 — provider temporarily unavailable.
  if (status === 503) {
    return {
      errorClass: "retry",
      code: "GEMINI_SERVICE_UNAVAILABLE",
      detail: "Gemini returned 503 (service unavailable).",
      status,
    };
  }

  // 500 / 502 — provider-side internal errors.
  if (status === 500 || status === 502) {
    return {
      errorClass: "retry",
      code: "GEMINI_INTERNAL_ERROR",
      detail: `Gemini returned ${status} (temporary provider error).`,
      status,
    };
  }

  // Unexpected status: retry only if the status is known-transient.
  if (RETRYABLE_STATUSES.has(status)) {
    return { errorClass: "retry", code: "GEMINI_INTERNAL_ERROR", detail: `Gemini returned ${status}.`, status };
  }

  return {
    errorClass: "failover",
    code: "GEMINI_SERVICE_UNAVAILABLE",
    detail: `Gemini returned an unexpected status ${status}.`,
    status,
  };
}

// --- Input types --------------------------------------------------------------

export interface GeminiImageInput {
  base64Data: string;
  mimeType: string;
}

export interface GenerateJsonInput<T> {
  /** Server-side system instruction describing the task and the exact JSON shape. */
  systemInstruction: string;
  /** The per-request user message (may embed format/mode instructions or a previous result). */
  prompt: string;
  /** Optional images attached after the system instruction, before the prompt. */
  images?: GeminiImageInput[];
  /** Zod schema the raw JSON must satisfy before anything reaches the frontend. */
  schema: ZodType<T, ZodTypeDef, any>;
  temperature?: number;
  /** Notified before each retry so the route can stream progress to the UI. */
  onProgress?: (event: ApiProgressEvent) => void;
}

interface RetryContext {
  deadline: number;
  onProgress?: (event: ApiProgressEvent) => void;
}

// --- Single HTTP attempt ------------------------------------------------------

interface AttemptSuccess {
  ok: true;
  data: unknown;
}
interface AttemptFailure {
  ok: false;
  classified: ClassifiedError;
}

async function attemptGeminiRequest(
  configuredKey: ConfiguredKey,
  model: string,
  input: GenerateJsonInput<unknown>
): Promise<AttemptSuccess | AttemptFailure> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${configuredKey.key}`;

  const parts: unknown[] = [{ text: input.systemInstruction }];
  for (const image of input.images ?? []) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64Data } });
  }
  parts.push({ text: input.prompt });

  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: input.temperature ?? 0.35,
      responseMimeType: "application/json",
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    const isAbort = err instanceof Error && err.name === "AbortError";
    const code: GeminiErrorCode = isAbort ? "GEMINI_TIMEOUT" : "GEMINI_NETWORK_ERROR";
    const detail = isAbort
      ? `Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s.`
      : "Network failure while calling Gemini.";
    logError(`Error: ${code} — ${detail}`);
    logGeminiError(model, "n/a", code, detail);
    return { ok: false, classified: { errorClass: "retry", code, detail } };
  }
  clearTimeout(timeout);

  log(`Status: ${response.status} (${Date.now() - startedAt}ms)`);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const retryAfter = response.headers.get("retry-after");
    const classified = classifyHttpError(response.status, text, retryAfter);
    logError(`Error: ${classified.code} — ${classified.detail}`);
    logGeminiError(model, response.status, classified.code, classified.detail);
    return { ok: false, classified };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    logError("Error: GEMINI_INVALID_RESPONSE — response body was not readable JSON.");
    logGeminiError(model, 200, "GEMINI_INVALID_RESPONSE", "Response body was not readable JSON.");
    return {
      ok: false,
      classified: {
        errorClass: "retry",
        code: "GEMINI_INVALID_RESPONSE",
        detail: "Gemini returned an unreadable response body.",
        status: 200,
      },
    };
  }

  return { ok: true, data: json };
}

// --- Parse + validate a successful response -----------------------------------

/**
 * Best-effort safe parsing: strips code fences, then — if plain JSON.parse
 * fails — extracts the first balanced JSON object from the text. Validation
 * (Zod) still gates everything; parsing fixes never fabricate data.
 */
function extractJsonCandidate(rawText: string): string | undefined {
  const cleaned = rawText
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // fall through to substring extraction
  }

  const start = cleaned.indexOf("{");
  if (start === -1) return undefined;
  const end = cleaned.lastIndexOf("}");
  if (end <= start) return undefined;
  const candidate = cleaned.slice(start, end + 1);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}

function parseAndValidate<T>(
  json: unknown,
  schema: ZodType<T, ZodTypeDef, any>
): { ok: true; data: T } | { ok: false; reason: string } {
  const rawText: string | undefined = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    return { ok: false, reason: "Gemini response had no text content." };
  }

  const candidate = extractJsonCandidate(rawText);
  if (candidate === undefined) {
    return { ok: false, reason: "Gemini response was not valid JSON." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return { ok: false, reason: "Gemini response was not valid JSON." };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "Gemini response did not match the expected schema." };
  }

  return { ok: true, data: result.data };
}

// --- Per-key loop: retries with backoff for transient errors ------------------

interface KeyFailure {
  errorClass: ErrorClass | "budget";
  code: GeminiErrorCode;
  message: string;
}

async function runWithKey<T>(
  configuredKey: ConfiguredKey,
  model: string,
  input: GenerateJsonInput<T>,
  ctx: RetryContext
): Promise<{ ok: true; data: T } | { ok: false; failure: KeyFailure }> {
  let lastCode: GeminiErrorCode = "GEMINI_INTERNAL_ERROR";
  let lastDetail = "Unknown error.";

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    if (Date.now() >= ctx.deadline) {
      logError(`Error: budget exhausted before attempt ${attempt} on ${configuredKey.label}.`);
      return {
        ok: false,
        failure: { errorClass: "budget", code: lastCode, message: lastDetail },
      };
    }

    log(`Attempt: ${attempt} (${configuredKey.label})`);
    const outcome = await attemptGeminiRequest(configuredKey, model, input);

    if (outcome.ok) {
      const validated = parseAndValidate(outcome.data, input.schema);
      if (validated.ok) {
        log(`Success on ${configuredKey.label}`);
        return { ok: true, data: validated.data };
      }

      lastCode = "GEMINI_INVALID_RESPONSE";
      lastDetail = validated.reason;
      logError(`Error: GEMINI_INVALID_RESPONSE — ${validated.reason}`);
    } else {
      const { errorClass, code, detail, retryAfterMs } = outcome.classified;
      lastCode = code;
      lastDetail = detail;

      if (errorClass === "fatal") {
        return { ok: false, failure: { errorClass: "fatal", code, message: detail } };
      }

      if (errorClass === "failover") {
        log(`Not retrying ${configuredKey.label} (${code}) — trying next key if available.`);
        return { ok: false, failure: { errorClass: "failover", code, message: detail } };
      }

      // Transient: stop early if there are no retries left in this request's budget.
      if (attempt > MAX_RETRIES) {
        logError(`Error: ${code} — retries exhausted on ${configuredKey.label}.`);
        return { ok: false, failure: { errorClass: "failover", code, message: detail } };
      }

      const retry = attempt; // the retry that is about to run
      const delay = backoffDelayMs(retry, retryAfterMs);

      if (Date.now() + delay >= ctx.deadline) {
        logError(`Error: ${code} — no budget left for retry ${retry}/${MAX_RETRIES}.`);
        return { ok: false, failure: { errorClass: "budget", code, message: detail } };
      }

      const progress: ApiProgressEvent = {
        retry,
        maxRetries: MAX_RETRIES,
        code,
        message: RETRY_MESSAGES[code] ?? ERROR_MESSAGES[code],
        delayMs: delay,
      };
      try {
        ctx.onProgress?.(progress);
      } catch {
        // a broken progress callback must never break the request itself
      }

      log(`Retrying in ${formatSeconds(delay)} (retry ${retry}/${MAX_RETRIES})`);
      await sleep(delay);
      continue;
    }

    // Invalid response path: allow a controlled retry, then fail over.
    if (attempt > MAX_RETRIES) {
      return {
        ok: false,
        failure: { errorClass: "failover", code: "GEMINI_INVALID_RESPONSE", message: lastDetail },
      };
    }

    const delay = backoffDelayMs(attempt);
    if (Date.now() + delay >= ctx.deadline) {
      logError(`Error: GEMINI_INVALID_RESPONSE — no budget left for retry.`);
      return {
        ok: false,
        failure: { errorClass: "budget", code: "GEMINI_INVALID_RESPONSE", message: lastDetail },
      };
    }

    try {
      ctx.onProgress?.({
        retry: attempt,
        maxRetries: MAX_RETRIES,
        code: "GEMINI_INVALID_RESPONSE",
        message: RETRY_MESSAGES.GEMINI_INVALID_RESPONSE,
        delayMs: delay,
      });
    } catch {
      // ignore progress callback failures
    }

    log(`Retrying in ${formatSeconds(delay)} (retry ${attempt}/${MAX_RETRIES}) — invalid response`);
    await sleep(delay);
  }

  return { ok: false, failure: { errorClass: "failover", code: lastCode, message: lastDetail } };
}

// --- Try every configured key against one model --------------------------------

/**
 * Which failure to surface when keys fail differently. The most specific,
 * most actionable code wins so users never see a generic message when a
 * precise cause is known.
 */
const CODE_PRIORITY: GeminiErrorCode[] = [
  "MISSING_GEMINI_API_KEY",
  "GEMINI_MODEL_NOT_FOUND",
  "GEMINI_AUTH_FAILED",
  "GEMINI_ACCESS_DENIED",
  "GEMINI_RATE_LIMITED",
  "GEMINI_BAD_REQUEST",
  "GEMINI_INVALID_RESPONSE",
  "GEMINI_TIMEOUT",
  "GEMINI_NETWORK_ERROR",
  "GEMINI_SERVICE_UNAVAILABLE",
  "GEMINI_INTERNAL_ERROR",
];

function mergeFailureCodes(codes: GeminiErrorCode[]): GeminiErrorCode {
  if (codes.length === 0) return "GEMINI_INTERNAL_ERROR";
  const unique = new Set(codes);
  if (unique.size === 1) return codes[0];
  for (const code of CODE_PRIORITY) {
    if (unique.has(code)) return code;
  }
  return "GEMINI_SERVICE_UNAVAILABLE";
}

interface AllKeysOutcome<T> {
  ok: boolean;
  data?: T;
  fatal: boolean;
  budgetExhausted: boolean;
  failures: GeminiErrorCode[];
}

async function attemptAllKeysForModel<T>(
  keys: ConfiguredKey[],
  model: string,
  input: GenerateJsonInput<T>,
  ctx: RetryContext
): Promise<AllKeysOutcome<T>> {
  const failures: GeminiErrorCode[] = [];

  for (let i = 0; i < keys.length; i++) {
    const configuredKey = keys[i];
    const result = await runWithKey(configuredKey, model, input, ctx);

    if (result.ok) {
      return { ok: true, data: result.data, fatal: false, budgetExhausted: false, failures };
    }

    const { errorClass, code } = result.failure;
    failures.push(code);
    logError(`Error on ${configuredKey.label}: ${code} — ${result.failure.message}`);

    if (errorClass === "fatal") {
      return { ok: false, fatal: true, budgetExhausted: false, failures };
    }

    if (errorClass === "budget") {
      return { ok: false, fatal: false, budgetExhausted: true, failures };
    }

    if (i < keys.length - 1) {
      log(`Switching to ${keys[i + 1].label}`);
    }
  }

  return { ok: false, fatal: false, budgetExhausted: false, failures };
}

// --- Public entry point --------------------------------------------------------

/**
 * Runs the configured Gemini key(s) against one prompt (+ optional
 * images), retrying transient failures (408/429/500/502/503/504) with
 * jittered exponential backoff (1s, 2s, 4s, 8s — up to 4 retries), then
 * failing over to the next key, and finally to GEMINI_MODEL_FALLBACK if
 * configured.
 *
 * `input.onProgress` is called before every retry so routes can stream
 * "Retry attempt N/4" updates to the UI.
 *
 * Throws GeminiError — and never fabricates a result — with a precise
 * error code (see GeminiErrorCode) if every key fails against every
 * configured model, or if the failure is a fatal configuration problem
 * such as an unknown model.
 */
export async function generateJson<T>(input: GenerateJsonInput<T>): Promise<T> {
  const keys = getGeminiKeys();
  const model = getGeminiModel();
  const fallbackModel = getGeminiFallbackModel();

  if (keys.length === 0) {
    throw new GeminiNotConfiguredError();
  }

  const ctx: RetryContext = { deadline: Date.now() + TOTAL_BUDGET_MS, onProgress: input.onProgress };

  log("Request started");
  log(`Model: ${model} (${keys.length} key(s))`);

  const primaryOutcome = await attemptAllKeysForModel(keys, model, input, ctx);

  if (primaryOutcome.ok && primaryOutcome.data !== undefined) {
    return primaryOutcome.data;
  }

  const primaryCode = mergeFailureCodes(primaryOutcome.failures);

  function fail(failedModel: string, code: GeminiErrorCode): never {
    logGeminiError(failedModel, "final", code, ERROR_MESSAGES[code]);
    throw new GeminiError(ERROR_MESSAGES[code], code);
  }

  if (primaryOutcome.fatal) {
    logError(`Fatal configuration error on model "${model}" — not retrying: ${primaryCode}`);
    fail(model, primaryCode);
  }

  if (primaryOutcome.budgetExhausted) {
    logError(`Request budget exhausted on model "${model}": ${primaryCode}`);
    fail(model, primaryCode);
  }

  if (fallbackModel && fallbackModel !== model) {
    logError(`All keys failed on model "${model}" — trying fallback model "${fallbackModel}"`);
    const fallbackOutcome = await attemptAllKeysForModel(keys, fallbackModel, input, ctx);

    if (fallbackOutcome.ok && fallbackOutcome.data !== undefined) {
      return fallbackOutcome.data;
    }

    const fallbackCode = mergeFailureCodes(fallbackOutcome.failures);
    logError(`All keys failed on fallback model "${fallbackModel}": ${fallbackCode}`);
    fail(fallbackModel, fallbackCode);
  }

  logError(`All configured key(s) failed: ${primaryCode}`);
  fail(model, primaryCode);
}
