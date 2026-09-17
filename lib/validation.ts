import { z } from "zod";

/**
 * Schema the AI model's JSON response must satisfy before we ever
 * trust it or hand it to the frontend. If this fails validation we
 * treat the analysis as a failed request rather than guessing.
 */
export const IssueTypeEnum = z.enum([
  "spelling",
  "grammar",
  "punctuation",
  "capitalization",
  "wording",
  "structure",
  "clarity",
  "duplication",
  "cta",
  "other",
]);

export const SeverityEnum = z.enum(["critical", "high", "medium", "low"]);

export const TextIssueSchema = z.object({
  type: IssueTypeEnum,
  severity: SeverityEnum,
  original: z.string().min(1).max(400),
  correction: z.string().min(0).max(400),
  explanation: z.string().min(1).max(400),
});

export const CopyReviewSchema = z.object({
  hook: z.string().min(1).max(300),
  clarity: z.string().min(1).max(300),
  valueProposition: z.string().min(1).max(300),
  cta: z.string().min(1).max(300),
  readability: z.string().min(1).max(300),
  conciseness: z.string().min(1).max(300),
  tone: z.string().min(1).max(300),
  overall: z.string().min(1).max(500),
});

export const AiAnalysisSchema = z.object({
  overallStatus: z.enum(["correct", "needs_improvement", "incorrect"]),
  confidence: z.number().min(0).max(1),
  qualityScore: z.number().min(0).max(100),
  ocrConfidence: z.number().min(0).max(1),
  extractedText: z.string().max(4000),
  hasReadableText: z.boolean(),
  issues: z.array(TextIssueSchema).max(40),
  correctedText: z.string().max(4000),
  copyReview: CopyReviewSchema,
  notes: z.string().max(500).optional(),
});

export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

// --- File validation -------------------------------------------------

export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB, configurable

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export function validateImageFile(file: { type: string; size: number }): FileValidationResult {
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: "Please upload a JPG, PNG, or WEBP image." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: "This image is too large. Please upload a smaller file." };
  }
  if (file.size === 0) {
    return { valid: false, error: "That file looks empty. Please choose a different image." };
  }
  return { valid: true };
}
