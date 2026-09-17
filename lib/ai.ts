import { AiAnalysisSchema, type AiAnalysis } from "./validation";

/**
 * Server-side AI system instruction.
 *
 * The model analyzes ONLY text visible in the uploaded image.
 * It must return structured JSON matching AiAnalysisSchema.
 */
const SYSTEM_PROMPT = `You are an expert copy editor, grammar checker, and social media marketing copy reviewer.

You will be shown an image of a social media post, advertisement, banner, story design, or similar marketing graphic.

Your job:

1. Read ONLY the text that is visibly present in the image.
2. Do not invent, guess, or complete missing or unreadable text.
3. If visible text is unclear, cut off, or too low-resolution to read confidently, say so plainly and lower your confidence score.
4. Evaluate the extracted text for:
   - spelling
   - grammar
   - punctuation
   - capitalization
   - wording
   - sentence structure
   - clarity
   - readability
   - CTA effectiveness
   - overall marketing communication
5. Classify the overall status as exactly one of:
   - "correct"
   - "needs_improvement"
   - "incorrect"
6. List concrete issues.

For each issue provide:
- issue type
- severity
- exact original snippet
- corrected version
- short explanation

Do not list purely stylistic preferences as definite errors.
Use "low" severity for optional improvements.

7. Produce a corrected version of the FULL extracted text.

Preserve the original meaning, tone, and intent.

Do NOT change:
- brand names
- product names
- company names
- URLs
- phone numbers
- prices
- dates
- hashtags
- industry-specific terminology

unless they contain an obvious typo.

8. Give a short, specific marketing copy review covering:
- hook
- clarity
- value proposition
- CTA
- readability
- conciseness
- tone
- overall summary

9. Give:
- qualityScore from 0-100
- confidence from 0-1
- ocrConfidence from 0-1

Respond ONLY with a single JSON object.

The JSON must match exactly this structure:

{
  "overallStatus": "correct" | "needs_improvement" | "incorrect",
  "confidence": number,
  "qualityScore": number,
  "ocrConfidence": number,
  "extractedText": string,
  "hasReadableText": boolean,
  "issues": [
    {
      "type": "spelling"|"grammar"|"punctuation"|"capitalization"|"wording"|"structure"|"clarity"|"duplication"|"cta"|"other",
      "severity": "critical"|"high"|"medium"|"low",
      "original": string,
      "correction": string,
      "explanation": string
    }
  ],
  "correctedText": string,
  "copyReview": {
    "hook": string,
    "clarity": string,
    "valueProposition": string,
    "cta": string,
    "readability": string,
    "conciseness": string,
    "tone": string,
    "overall": string
  },
  "notes": string
}

If no readable text is present:

- hasReadableText = false
- extractedText = ""
- issues = []
- correctedText = ""

Still fill the copyReview fields with honest statements such as:
"No text was detected to review."

Explain the reason in notes.`;

export class AiAnalysisError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AiAnalysisError";
  }
}

interface AnalyzeImageInput {
  base64Data: string;
  mimeType: string;
}

/**
 * Retry configuration.
 */
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1500;
const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Gemini currently supports this stable multimodal model.
 */
const MODEL = "gemini-3.6-flash";

/**
 * HTTP statuses that normally indicate a temporary provider problem.
 */
function isRetryableStatus(status: number): boolean {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504
  );
}

/**
 * Wait helper.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls Gemini Vision and returns a validated AiAnalysis object.
 */
export async function analyzeImageWithAi({
  base64Data,
  mimeType,
}: AnalyzeImageInput): Promise<AiAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new AiAnalysisError(
      "The AI provider is not configured on the server."
    );
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${MODEL}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: SYSTEM_PROMPT,
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
          {
            text:
              "Analyze the text in this image now and return only the JSON object described above.",
          },
        ],
      },
    ],

    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  };

  let lastError: unknown = null;

  /**
   * Retry temporary Gemini errors.
   */
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `Gemini analysis attempt ${attempt}/${MAX_RETRIES} using ${MODEL}`
      );

      const controller = new AbortController();

      const timeout = setTimeout(() => {
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

      let response: Response;

      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      /**
       * Gemini returned an HTTP error.
       */
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");

        console.error(
          `Gemini API error ${response.status}:`,
          errorText
        );

        /**
         * Temporary provider error.
         */
        if (isRetryableStatus(response.status)) {
          lastError = {
            status: response.status,
            response: errorText,
          };

          if (attempt < MAX_RETRIES) {
            const delay =
              INITIAL_RETRY_DELAY_MS *
              Math.pow(2, attempt - 1);

            console.log(
              `Temporary Gemini error ${response.status}. ` +
              `Retrying in ${delay}ms...`
            );

            await sleep(delay);
            continue;
          }

          throw new AiAnalysisError(
            `AI provider is temporarily unavailable (${response.status}).`,
            errorText
          );
        }

        /**
         * Permanent provider error.
         */
        throw new AiAnalysisError(
          `AI provider returned an error (${response.status}).`,
          errorText
        );
      }

      /**
       * Parse Gemini response.
       */
      let json: any;

      try {
        json = await response.json();
      } catch (err) {
        throw new AiAnalysisError(
          "The AI provider returned an unreadable response.",
          err
        );
      }

      /**
       * Extract generated text.
       */
      const rawText: string | undefined =
        json?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        console.error(
          "Gemini returned no generated text:",
          JSON.stringify(json, null, 2)
        );

        throw new AiAnalysisError(
          "The AI provider returned an empty response.",
          json
        );
      }

      /**
       * Remove accidental markdown fences.
       */
      const cleaned = rawText
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      /**
       * Parse JSON.
       */
      let parsed: unknown;

      try {
        parsed = JSON.parse(cleaned);
      } catch (err) {
        console.error(
          "Invalid JSON returned by Gemini:",
          rawText
        );

        throw new AiAnalysisError(
          "The AI response was not valid JSON.",
          err
        );
      }

      /**
       * Validate against your existing Zod schema.
       */
      const result = AiAnalysisSchema.safeParse(parsed);

      if (!result.success) {
        console.error(
          "Gemini response failed schema validation:",
          result.error.flatten()
        );

        throw new AiAnalysisError(
          "The AI response did not match the expected format.",
          result.error.flatten()
        );
      }

      console.log("Gemini analysis completed successfully.");

      return result.data;
    } catch (err) {
      lastError = err;

      /**
       * Abort means our request timeout fired.
       */
      if (
        err instanceof Error &&
        err.name === "AbortError"
      ) {
        console.error(
          `Gemini request timed out on attempt ${attempt}.`
        );

        if (attempt < MAX_RETRIES) {
          const delay =
            INITIAL_RETRY_DELAY_MS *
            Math.pow(2, attempt - 1);

          await sleep(delay);
          continue;
        }

        throw new AiAnalysisError(
          "The AI provider took too long to respond.",
          err
        );
      }

      /**
       * AiAnalysisError may already contain a meaningful
       * permanent or final error.
       */
      if (err instanceof AiAnalysisError) {
        /**
         * If the error is from a temporary HTTP status,
         * retry unless this was the final attempt.
         */
        const cause = err.cause as
          | { status?: number }
          | undefined;

        const status = cause?.status;

        if (
          status !== undefined &&
          isRetryableStatus(status) &&
          attempt < MAX_RETRIES
        ) {
          const delay =
            INITIAL_RETRY_DELAY_MS *
            Math.pow(2, attempt - 1);

          await sleep(delay);
          continue;
        }

        throw err;
      }

      /**
       * Unknown network/runtime error.
       */
      console.error(
        `Unexpected Gemini error on attempt ${attempt}:`,
        err
      );

      if (attempt < MAX_RETRIES) {
        const delay =
          INITIAL_RETRY_DELAY_MS *
          Math.pow(2, attempt - 1);

        await sleep(delay);
        continue;
      }

      throw new AiAnalysisError(
        "Could not complete AI analysis.",
        lastError
      );
    }
  }

  throw new AiAnalysisError(
    "AI provider is temporarily unavailable. Please try again.",
    lastError
  );
}