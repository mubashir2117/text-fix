import { AiAnalysisSchema, type AiAnalysis } from "./validation";

/**
 * ---------------------------------------------------------------------
 * AI Text Fixer — Gemini analysis with multi-key provider failover
 * ---------------------------------------------------------------------
 *
 * Architecture (unchanged from the app's existing shape):
 *
 *   app/api/analyze/route.ts
 *           |
 *           v
 *   lib/ai.ts  (this file)
 *           |
 *           v
 *   Gemini REST API  ->  AiAnalysisSchema validation  ->  route.ts  ->  frontend
 *
 * What this file adds: instead of calling one hardcoded API key, it
 * collects every configured GEMINI_API_KEY_n from the environment and
 * fails over to the next one when the current key/request hits a
 * transient provider error (503, 429, 5xx, timeout, network failure).
 *
 * IMPORTANT — this is key *failover*, not extra quota. If all of your
 * GEMINI_API_KEY_n values belong to the same Google Cloud project,
 * Gemini's rate limits are enforced at the project level, so rotating
 * between them will NOT give you a higher combined rate limit — it
 * only gives you redundancy if one key is individually revoked,
 * misconfigured, or you're spreading load across separate legitimately
 * owned projects. Do not use this as a way to bypass Google's quota
 * for a single project.
 */

export class AiAnalysisError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AiAnalysisError";
  }
}

// --- Server-side system instruction (preserved + extended) -------------

const SYSTEM_PROMPT = `You are an expert copy editor, grammar checker, capitalization specialist, OCR reviewer, and social media marketing copy reviewer.

You will be shown an image of a social media post, advertisement, banner, story design, screenshot, or similar graphic. Your job:

1. Read ONLY the text that is visibly present in the image, preserving its approximate reading order (headline, subheadline, body, CTA, labels, small text, hashtags, numbers, URLs, brand names). Do not invent, guess, or complete missing or unreadable text — if a section is unclear, cut off, or too low-resolution to read confidently, say so plainly and lower your confidence score rather than assuming what it says.
2. Evaluate the extracted text for: spelling, grammar, punctuation, sentence case, title case, capitalization consistency, keyword capitalization, proper nouns and brand terminology, clarity, readability, CTA effectiveness, and overall marketing communication.
3. Capitalization is contextual, not a fixed rule. Sentence case, Title Case, and ALL CAPS can all be intentional design choices — do not flag a headline simply for being uppercase or title-cased. Only flag capitalization when it is inconsistent with the style the design itself establishes (e.g. one word in a Title Case headline left lowercase, or a sentence-case line with a random word capitalized).
4. Never invent or "correct" brand names, product names, company names, acronyms, URLs, phone numbers, prices, dates, or hashtags to match a different capitalization convention — preserve them exactly as shown unless they contain an obvious typo. When the same keyword or brand term appears more than once with different capitalization, report the inconsistency and recommend the form that is most consistent with the majority usage, but never invent a capitalization the design doesn't establish anywhere.
5. List concrete issues as they're found. For each: the issue type, an optional finer-grained category (e.g. "sentence_case", "title_case", "keyword_capitalization"), severity, the exact original snippet, a corrected version of that snippet, and a short plain-English explanation. Separate definite errors from optional stylistic preferences by giving optional ones "low" severity — do not mark text as incorrect simply because you would have written it differently.
6. Produce a corrected version of the FULL extracted text. Preserve the original meaning, tone, and intent. Do NOT change brand names, product names, URLs, prices, numbers, hashtags, or intentional design styling. Do not rewrite text that is already correct just to change its style.
7. Give a short, specific marketing-copy review: hook, clarity, value proposition, CTA, readability, conciseness, tone, and one overall summary sentence. Write real sentences, not single-word scores.
8. Where useful, break the extracted text into blocks (headline, subheadline, body, cta, label, etc.) and record the capitalization style you detect for each block (sentence_case, title_case, all_caps, lowercase, or mixed_case).
9. Track any keyword or brand term that appears more than once. For each, list the exact variants you saw, whether they're consistent, and the recommended form.
10. Fill in an overall case-analysis summary: which styles you detected, and a pass/warning/fail check for sentence case, title case, keyword capitalization, and proper nouns, plus one overall check.
11. Give a qualityScore from 0-100 reflecting overall text quality, a confidence (0-1) in the whole assessment, and an ocrConfidence (0-1) in how accurately you read the text.

Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:

{
  "overallStatus": "correct" | "needs_improvement" | "incorrect",
  "confidence": number between 0 and 1,
  "qualityScore": number between 0 and 100,
  "ocrConfidence": number between 0 and 1,
  "extractedText": string,
  "hasReadableText": boolean,
  "issues": [
    { "type": "spelling"|"grammar"|"punctuation"|"capitalization"|"wording"|"structure"|"clarity"|"duplication"|"cta"|"other",
      "category": string (optional, e.g. "sentence_case"),
      "severity": "critical"|"high"|"medium"|"low",
      "original": string,
      "correction": string,
      "explanation": string }
  ],
  "correctedText": string,
  "copyReview": {
    "hook": string, "clarity": string, "valueProposition": string, "cta": string,
    "readability": string, "conciseness": string, "tone": string, "overall": string
  },
  "textBlocks": [
    { "text": string, "role": string, "caseStyle": "sentence_case"|"title_case"|"all_caps"|"lowercase"|"mixed_case" }
  ],
  "keywordAnalysis": [
    { "keyword": string, "detectedVariants": string[], "recommendedForm": string, "consistent": boolean }
  ],
  "caseAnalysis": {
    "detectedStyles": ["sentence_case"|"title_case"|"all_caps"|"lowercase"|"mixed_case"],
    "sentenceCase": "pass"|"warning"|"fail",
    "titleCase": "pass"|"warning"|"fail",
    "keywordCapitalization": "pass"|"warning"|"fail",
    "properNouns": "pass"|"warning"|"fail",
    "overall": "pass"|"warning"|"fail"
  },
  "notes": string (optional, e.g. warnings about unreadable sections)
}

If no readable text is present in the image at all, set hasReadableText to false, extractedText to an empty string, issues/textBlocks/keywordAnalysis to empty arrays, correctedText to an empty string, still fill copyReview fields with short honest statements like "No text was detected to review.", caseAnalysis fields as "pass" with an empty detectedStyles array, and explain in notes why.`;

// --- Provider key + model configuration ---------------------------------

interface ConfiguredKey {
  key: string;
  /** Safe-to-log identifier, e.g. "key-1". Never log the raw key value. */
  label: string;
}

function getConfiguredKeys(): ConfiguredKey[] {
  const envVars = [
    "GEMINI_API_KEY_1",
    "GEMINI_API_KEY_2",
    "GEMINI_API_KEY_3",
    "GEMINI_API_KEY_4",
    "GEMINI_API_KEY_5",
  ] as const;

  return envVars
    .map((name, index) => ({ key: process.env[name], label: `key-${index + 1}` }))
    .filter((entry): entry is ConfiguredKey => Boolean(entry.key && entry.key.trim().length > 0))
    .map((entry) => ({ key: entry.key as string, label: entry.label }));
}

function getModel(): string {
  return (process.env.GEMINI_MODEL && process.env.GEMINI_MODEL.trim()) || "gemini-3.6-flash";
}

/** Optional — tried only after every key has failed against GEMINI_MODEL with a non-fatal error. */
function getFallbackModel(): string | undefined {
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
  base64Data: string,
  mimeType: string
): Promise<AttemptSuccess | AttemptFailure> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${configuredKey.key}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: SYSTEM_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64Data } },
          { text: "Analyze the text in this image now and return only the JSON object described above." },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
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
  } catch (err) {
    return {
      ok: false,
      classified: { errorClass: "retry-same-key", message: "Gemini returned an unreadable response body." },
    };
  }

  return { ok: true, data: json };
}

// --- Parse + validate a successful response -------------------------------

function parseAndValidate(json: unknown): { ok: true; data: AiAnalysis } | { ok: false; reason: string } {
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

  const result = AiAnalysisSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, reason: "Gemini response did not match the expected schema." };
  }

  return { ok: true, data: result.data };
}

// --- Per-key loop: retries with backoff for transient errors --------------

async function runWithKey(
  configuredKey: ConfiguredKey,
  model: string,
  base64Data: string,
  mimeType: string
): Promise<{ ok: true; data: AiAnalysis } | { ok: false; errorClass: ErrorClass; message: string }> {
  let lastMessage = "Unknown error.";

  for (let attempt = 1; attempt <= MAX_RETRIES_PER_KEY + 1; attempt++) {
    log(`Attempt ${attempt} using ${configuredKey.label}`);
    const outcome = await attemptGeminiRequest(configuredKey, model, base64Data, mimeType);

    if (outcome.ok) {
      const validated = parseAndValidate(outcome.data);
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

interface AllKeysOutcome {
  ok: boolean;
  data?: AiAnalysis;
  fatal: boolean;
  failures: string[];
}

async function attemptAllKeysForModel(
  keys: ConfiguredKey[],
  model: string,
  base64Data: string,
  mimeType: string
): Promise<AllKeysOutcome> {
  const failures: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const configuredKey = keys[i];
    const result = await runWithKey(configuredKey, model, base64Data, mimeType);

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

interface AnalyzeImageInput {
  base64Data: string;
  mimeType: string;
}

/**
 * Runs the configured Gemini key(s) against one image, failing over to
 * the next key on transient errors, and returns a validated AiAnalysis.
 *
 * If GEMINI_MODEL_FALLBACK is set and EVERY key fails against the
 * primary GEMINI_MODEL for a non-fatal reason (e.g. sustained 503s —
 * the whole model tier is under demand pressure, not just one key),
 * the full key list is tried again against the fallback model before
 * giving up. This is separate from key failover: it's model failover,
 * for the case where the bottleneck is Google's capacity for that
 * specific model rather than any one API key.
 *
 * Throws AiAnalysisError — and never fabricates a result — if every
 * key fails against every configured model, or if the failure is a
 * fatal (non-key-specific) configuration problem such as an unknown
 * model name.
 */
export async function analyzeImageWithAi({ base64Data, mimeType }: AnalyzeImageInput): Promise<AiAnalysis> {
  const keys = getConfiguredKeys();
  const model = getModel();
  const fallbackModel = getFallbackModel();

  if (keys.length === 0) {
    throw new AiAnalysisError("The AI provider is not configured on the server.");
  }

  log(`Trying model "${model}" across ${keys.length} configured key(s)`);
  const primaryOutcome = await attemptAllKeysForModel(keys, model, base64Data, mimeType);

  if (primaryOutcome.ok && primaryOutcome.data) {
    return primaryOutcome.data;
  }

  if (primaryOutcome.fatal) {
    logError(`Fatal configuration error on model "${model}" — not attempting further keys or models: ${primaryOutcome.failures.join(" | ")}`);
    throw new AiAnalysisError(
      "The AI provider is misconfigured (unknown model). Please check the server configuration.",
      primaryOutcome.failures
    );
  }

  const allFailures = [...primaryOutcome.failures];

  if (fallbackModel && fallbackModel !== model) {
    logError(`All keys failed on model "${model}" — trying fallback model "${fallbackModel}"`);
    const fallbackOutcome = await attemptAllKeysForModel(keys, fallbackModel, base64Data, mimeType);

    if (fallbackOutcome.ok && fallbackOutcome.data) {
      return fallbackOutcome.data;
    }

    allFailures.push(...fallbackOutcome.failures.map((f) => `[fallback model] ${f}`));

    if (fallbackOutcome.fatal) {
      logError(`Fatal configuration error on fallback model "${fallbackModel}": ${fallbackOutcome.failures.join(" | ")}`);
      throw new AiAnalysisError(
        "The AI provider is misconfigured (unknown fallback model). Please check the server configuration.",
        allFailures
      );
    }
  }

  logError(`All configured key(s) and model(s) failed: ${allFailures.join(" | ")}`);
  throw new AiAnalysisError("All configured AI providers are temporarily unavailable.", allFailures);
}
