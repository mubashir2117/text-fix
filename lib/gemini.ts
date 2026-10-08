import type { ZodType, ZodTypeDef } from "zod";

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
 * Every function here works on generic, schema-validated JSON so both
 * the text-analysis flow (lib/ai.ts) and the design-recreation flow
 * (lib/recreate.ts) share the same transport, retry and validation
 * behavior.
 */

// --- Errors -------------------------------------------------------------

/**
 * Thrown for any Gemini-side failure: missing keys, invalid/expired
 * keys, rate limits, timeouts, network failures, unknown model, or an
 * invalid/malformed response. Messages are safe to log — they never
 * contain the API key, image payload, or raw provider credentials.
 */
export class GeminiError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "GeminiError";
  }
}

/** Raised when no server-side Gemini key is configured at all. */
export class GeminiNotConfiguredError extends GeminiError {
  constructor(message = "The AI provider is not configured on the server.") {
    super(message);
    this.name = "GeminiNotConfiguredError";
  }
}

// --- Server-side configuration ------------------------------------------

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

// --- Logging (never logs key values or image data) ----------------------

function log(message: string) {
  console.log(`[gemini] ${message}`);
}

function logError(message: string) {
  console.error(`[gemini] ${message}`);
}

// --- Retry / backoff configuration --------------------------------------

const MAX_RETRIES_PER_KEY = 2; // up to 3 attempts total per key
const BASE_BACKOFF_MS = 1000;
const REQUEST_TIMEOUT_MS = 40_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** attempt 1 -> ~1s, attempt 2 -> ~2s, with a little jitter so parallel requests don't retry in lockstep. */
function backoffDelayMs(attempt: number): number {
  return BASE_BACKOFF_MS * attempt + Math.random() * 300;
}

// --- Error classification -------------------------------------------------

type ErrorClass =
  | "retry-same-key" // transient — worth retrying this same key with backoff
  | "failover-now" // don't waste retries on this key — move to the next one immediately
  | "fatal"; // not key-specific — retrying with another key won't help

interface ClassifiedError {
  errorClass: ErrorClass;
  message: string;
  retryAfterMs?: number;
}

function classifyHttpError(status: number, body: string, retryAfterHeader: string | null): ClassifiedError {
  // 404 — wrong/unavailable model name. Every key shares the same model,
  // so rotating keys will not fix this; surface it as a config problem.
  if (status === 404) {
    return {
      errorClass: "fatal",
      message: `Gemini model not found (404). Check the GEMINI_MODEL environment variable — current value may not exist or may not be available to your account's API version.`,
    };
  }

  // 401 — this specific key is invalid/revoked. No point retrying it.
  if (status === 401) {
    return { errorClass: "failover-now", message: "Gemini returned 401 (invalid or unauthorized API key)." };
  }

  // 400 / 403 — bad request or forbidden. Usually not fixed by retrying
  // the same key repeatedly, but a different key/project might not be
  // similarly restricted, so move on rather than looping.
  if (status === 400 || status === 403) {
    return { errorClass: "failover-now", message: `Gemini returned ${status}: ${body.slice(0, 200)}` };
  }

  // 429 — rate limited. Respect Retry-After if Gemini sent one.
  if (status === 429) {
    const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : undefined;
    return {
      errorClass: "retry-same-key",
      message: "Gemini returned 429 (RESOURCE_EXHAUSTED).",
      retryAfterMs: retryAfterMs && !Number.isNaN(retryAfterMs) ? retryAfterMs : undefined,
    };
  }

  // 500 / 502 / 503 / 504 — transient provider-side issues.
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { errorClass: "retry-same-key", message: `Gemini returned ${status} (temporary provider error).` };
  }

  // Anything else: treat as failover-worthy but not fatal.
  return { errorClass: "failover-now", message: `Gemini returned an unexpected status ${status}.` };
}

// --- Input types ----------------------------------------------------------

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
}

// --- Single HTTP attempt --------------------------------------------------

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
    return {
      ok: false,
      classified: {
        errorClass: "retry-same-key",
        message: isAbort ? "Gemini request timed out." : "Network failure while calling Gemini.",
      },
    };
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const retryAfter = response.headers.get("retry-after");
    return { ok: false, classified: classifyHttpError(response.status, text, retryAfter) };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return {
      ok: false,
      classified: { errorClass: "retry-same-key", message: "Gemini returned an unreadable response body." },
    };
  }

  return { ok: true, data: json };
}

// --- Parse + validate a successful response -------------------------------

function parseAndValidate<T>(
  json: unknown,
  schema: ZodType<T, ZodTypeDef, any>
): { ok: true; data: T } | { ok: false; reason: string } {
  const rawText: string | undefined = (json as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    return { ok: false, reason: "Gemini response had no text content." };
  }

  const cleaned = rawText
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, reason: "Gemini response was not valid JSON." };
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "Gemini response did not match the expected schema." };
  }

  return { ok: true, data: result.data };
}

// --- Per-key loop: retries with backoff for transient errors --------------

async function runWithKey<T>(
  configuredKey: ConfiguredKey,
  model: string,
  input: GenerateJsonInput<T>
): Promise<{ ok: true; data: T } | { ok: false; errorClass: ErrorClass; message: string }> {
  let lastMessage = "Unknown error.";

  for (let attempt = 1; attempt <= MAX_RETRIES_PER_KEY + 1; attempt++) {
    log(`Attempt ${attempt} using ${configuredKey.label}`);
    const outcome = await attemptGeminiRequest(configuredKey, model, input);

    if (outcome.ok) {
      const validated = parseAndValidate(outcome.data, input.schema);
      if (validated.ok) {
        log(`Request succeeded using ${configuredKey.label}`);
        return { ok: true, data: validated.data };
      }

      // A malformed/invalid response isn't a provider outage, but it's
      // also not necessarily this key's fault — worth one retry on the
      // same key (generation is non-deterministic) before failing over.
      lastMessage = validated.reason;
      log(`${configuredKey.label} returned an invalid response: ${validated.reason}`);
      if (attempt <= MAX_RETRIES_PER_KEY) {
        const delay = backoffDelayMs(attempt);
        log(`Retrying ${configuredKey.label} in ~${Math.round(delay)}ms`);
        await sleep(delay);
        continue;
      }
      return { ok: false, errorClass: "failover-now", message: lastMessage };
    }

    const { errorClass, message, retryAfterMs } = outcome.classified;
    lastMessage = message;
    log(`${configuredKey.label} -> ${message}`);

    if (errorClass === "fatal") {
      return { ok: false, errorClass, message };
    }

    if (errorClass === "failover-now") {
      log(`Switching away from ${configuredKey.label} (non-retryable on this key)`);
      return { ok: false, errorClass, message };
    }

    // retry-same-key
    if (attempt <= MAX_RETRIES_PER_KEY) {
      const delay = retryAfterMs ?? backoffDelayMs(attempt);
      log(`Retrying ${configuredKey.label} in ~${Math.round(delay)}ms`);
      await sleep(delay);
      continue;
    }

    log(`${configuredKey.label} exhausted its retries — switching to next key`);
    return { ok: false, errorClass: "failover-now", message: lastMessage };
  }

  return { ok: false, errorClass: "failover-now", message: lastMessage };
}

// --- Try every configured key against one model ---------------------------

interface AllKeysOutcome<T> {
  ok: boolean;
  data?: T;
  fatal: boolean;
  failures: string[];
}

async function attemptAllKeysForModel<T>(
  keys: ConfiguredKey[],
  model: string,
  input: GenerateJsonInput<T>
): Promise<AllKeysOutcome<T>> {
  const failures: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const configuredKey = keys[i];
    const result = await runWithKey(configuredKey, model, input);

    if (result.ok) {
      return { ok: true, data: result.data, fatal: false, failures };
    }

    failures.push(`${configuredKey.label}: ${result.message}`);

    if (result.errorClass === "fatal") {
      return { ok: false, fatal: true, failures };
    }

    if (i < keys.length - 1) {
      log(`Switching to ${keys[i + 1].label}`);
    }
  }

  return { ok: false, fatal: false, failures };
}

// --- Public entry point ----------------------------------------------------

/**
 * Runs the configured Gemini key(s) against one prompt (+ optional
 * images), failing over to the next key on transient errors, and
 * returns a Zod-validated result.
 *
 * If GEMINI_MODEL_FALLBACK is set and EVERY key fails against the
 * primary GEMINI_MODEL for a non-fatal reason (e.g. sustained 503s —
 * the whole model tier is under demand pressure, not just one key),
 * the full key list is tried again against the fallback model before
 * giving up. This is separate from key failover: it's model failover,
 * for the case where the bottleneck is Google's capacity for that
 * specific model rather than any one API key.
 *
 * Throws GeminiError — and never fabricates a result — if every key
 * fails against every configured model, or if the failure is a fatal
 * (non-key-specific) configuration problem such as an unknown model.
 */
export async function generateJson<T>(input: GenerateJsonInput<T>): Promise<T> {
  const keys = getGeminiKeys();
  const model = getGeminiModel();
  const fallbackModel = getGeminiFallbackModel();

  if (keys.length === 0) {
    throw new GeminiNotConfiguredError();
  }

  log(`Trying model "${model}" across ${keys.length} configured key(s)`);
  const primaryOutcome = await attemptAllKeysForModel(keys, model, input);

  if (primaryOutcome.ok && primaryOutcome.data !== undefined) {
    return primaryOutcome.data;
  }

  if (primaryOutcome.fatal) {
    logError(
      `Fatal configuration error on model "${model}" — not attempting further keys or models: ${primaryOutcome.failures.join(" | ")}`
    );
    throw new GeminiError(
      "The AI provider is misconfigured (unknown model). Please check the server configuration.",
      primaryOutcome.failures
    );
  }

  const allFailures = [...primaryOutcome.failures];

  if (fallbackModel && fallbackModel !== model) {
    logError(`All keys failed on model "${model}" — trying fallback model "${fallbackModel}"`);
    const fallbackOutcome = await attemptAllKeysForModel(keys, fallbackModel, input);

    if (fallbackOutcome.ok && fallbackOutcome.data !== undefined) {
      return fallbackOutcome.data;
    }

    allFailures.push(...fallbackOutcome.failures.map((f) => `[fallback model] ${f}`));

    if (fallbackOutcome.fatal) {
      logError(`Fatal configuration error on fallback model "${fallbackModel}": ${fallbackOutcome.failures.join(" | ")}`);
      throw new GeminiError(
        "The AI provider is misconfigured (unknown fallback model). Please check the server configuration.",
        allFailures
      );
    }
  }

  logError(`All configured key(s) and model(s) failed: ${allFailures.join(" | ")}`);
  throw new GeminiError("All configured AI providers are temporarily unavailable.", allFailures);
}
