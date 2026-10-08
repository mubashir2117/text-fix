import { AiAnalysisSchema, type AiAnalysis } from "./validation";
import { generateJson, GeminiError } from "./gemini";
import { ApiError, type ApiErrorCode, type ApiProgressEvent } from "./errors";

/**
 * ---------------------------------------------------------------------
 * AI Text Fixer — Gemini text analysis
 * ---------------------------------------------------------------------
 *
 * Architecture:
 *
 *   app/api/analyze/route.ts
 *           |
 *           v
 *   lib/ai.ts  (this file)   — analysis-specific system prompt + schema
 *           |
 *           v
 *   lib/gemini.ts            — shared transport: GEMINI_API_KEY(_1..5)
 *           |                  failover, retries, timeouts, JSON parsing
 *           v
 *   Google Gemini API  ->  AiAnalysisSchema validation  ->  route.ts
 *
 * The design-recreation feature (lib/recreate.ts) uses the same
 * lib/gemini.ts transport with its own prompt and schema.
 */

export class AiAnalysisError extends ApiError {
  constructor(message: string, code: ApiErrorCode, cause?: unknown) {
    super(message, code, cause);
    this.name = "AiAnalysisError";
  }
}

// --- Server-side system instruction -------------------------------------

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

// --- Public entry point ----------------------------------------------------

interface AnalyzeImageInput {
  base64Data: string;
  mimeType: string;
  /** Notified before each Gemini retry so routes can stream progress to the UI. */
  onProgress?: (event: ApiProgressEvent) => void;
}

/**
 * Runs the configured Gemini key(s) against one image and returns a
 * validated AiAnalysis. All transport concerns (key failover, retry,
 * timeouts, model fallback, JSON parsing) live in lib/gemini.ts.
 *
 * Throws AiAnalysisError — and never fabricates a result — on any
 * failure, carrying the precise error code from GeminiErrorCode so the
 * route can return { success: false, error: { code, message } }.
 */
export async function analyzeImageWithAi({
  base64Data,
  mimeType,
  onProgress,
}: AnalyzeImageInput): Promise<AiAnalysis> {
  try {
    return await generateJson<AiAnalysis>({
      systemInstruction: SYSTEM_PROMPT,
      prompt: "Analyze the text in this image now and return only the JSON object described above.",
      images: [{ base64Data, mimeType }],
      schema: AiAnalysisSchema,
      temperature: 0.2,
      onProgress,
    });
  } catch (err) {
    if (err instanceof GeminiError) {
      // `err.message` is already a user-safe, code-specific message.
      throw new AiAnalysisError(err.message, err.code, err.cause);
    }
    throw err;
  }
}
