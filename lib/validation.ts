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
  // Optional finer-grained label, e.g. "sentence_case" under type "capitalization".
  category: z.string().max(60).optional(),
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

export const CaseStyleEnum = z.enum([
  "sentence_case",
  "title_case",
  "all_caps",
  "lowercase",
  "mixed_case",
]);

export const TextBlockSchema = z.object({
  text: z.string().max(400),
  role: z.string().max(40), // e.g. "headline", "subheadline", "body", "cta", "label"
  caseStyle: CaseStyleEnum,
});

export const KeywordAnalysisEntrySchema = z.object({
  keyword: z.string().min(1).max(80),
  detectedVariants: z.array(z.string().max(80)).min(1).max(10),
  recommendedForm: z.string().min(1).max(80),
  consistent: z.boolean(),
});

export const CaseCheckEnum = z.enum(["pass", "warning", "fail"]);

export const CaseAnalysisSchema = z.object({
  detectedStyles: z.array(CaseStyleEnum).max(5),
  sentenceCase: CaseCheckEnum,
  titleCase: CaseCheckEnum,
  keywordCapitalization: CaseCheckEnum,
  properNouns: CaseCheckEnum,
  overall: CaseCheckEnum,
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
  // Additive fields for the case/capitalization + keyword-consistency
  // features. Optional so older callers and cached history entries
  // that predate these fields keep validating.
  textBlocks: z.array(TextBlockSchema).max(60).optional(),
  keywordAnalysis: z.array(KeywordAnalysisEntrySchema).max(30).optional(),
  caseAnalysis: CaseAnalysisSchema.optional(),
});

export type AiAnalysis = z.infer<typeof AiAnalysisSchema>;

// --- Recreation: "Recreate This Post" ---------------------------------
//
// Schema for the structured JSON returned by the server-side design
// recreation flow (lib/recreate.ts). Deliberately tolerant: the model
// occasionally returns null/numeric values or a differently-cased enum
// value, and a single odd field should not fail an otherwise-usable
// recreation. Fields are normalized (colors, enums, defaults) before
// rendering in lib/formats.ts — normalizeRecreation().

export const PostFormatEnum = z.enum([
  "instagram_portrait",
  "instagram_square",
  "instagram_story",
  "reel_cover",
  "linkedin",
  "facebook",
  "custom",
]);

export type PostFormatId = z.infer<typeof PostFormatEnum>;

export const TextAlignmentEnum = z.enum(["left", "center", "right"]);

export type TextAlignment = z.infer<typeof TextAlignmentEnum>;

export const FontFamilyEnum = z.enum([
  "Inter",
  "Manrope",
  "Poppins",
  "DM Sans",
  "Plus Jakarta Sans",
]);

export type FontFamilyId = z.infer<typeof FontFamilyEnum>;

/** Accepts a string or number from the model and always yields a trimmed string. */
function looseString(max: number) {
  return z
    .union([z.string(), z.number()])
    .nullish()
    .transform((value) => (value === null || value === undefined ? "" : String(value).trim().slice(0, max)));
}

/** Maps free-form model wording ("Center-aligned", "centre", ...) onto our enum. */
function looseAlignment() {
  return z
    .string()
    .nullish()
    .transform((value): TextAlignment => {
      const v = (value ?? "").toLowerCase();
      if (v.includes("cent")) return "center";
      if (v.includes("right")) return "right";
      return "left";
    });
}

/** Maps free-form model wording onto the supported font family list. */
function looseFontFamily() {
  return z
    .string()
    .nullish()
    .transform((value): FontFamilyId => {
      const v = (value ?? "").toLowerCase();
      if (v.includes("manrope")) return "Manrope";
      if (v.includes("poppins")) return "Poppins";
      if (v.includes("jakarta")) return "Plus Jakarta Sans";
      if (v.includes("dm") && v.includes("sans")) return "DM Sans";
      return "Inter";
    });
}

export const RecreatedTextSchema = z.object({
  headline: looseString(300),
  subtitle: looseString(300),
  body: looseString(600),
  cta: looseString(80),
  label: looseString(80),
  price: looseString(80),
  contact: looseString(120),
  website: looseString(120),
  handle: looseString(80),
  hashtags: looseString(240),
});

export type RecreatedText = z.infer<typeof RecreatedTextSchema>;

export const RecreatedDesignSchema = z.object({
  background: looseString(200),
  primaryColor: looseString(80),
  secondaryColor: looseString(80),
  textColor: looseString(80),
  accentColor: looseString(80),
  buttonColor: looseString(80),
  alignment: looseAlignment(),
  visualHierarchy: looseString(500),
});

export type RecreatedDesign = z.infer<typeof RecreatedDesignSchema>;

export const RecreatedTypographySchema = z.object({
  headline: looseString(200),
  subtitle: looseString(200),
  body: looseString(200),
  cta: looseString(200),
});

export type RecreatedTypography = z.infer<typeof RecreatedTypographySchema>;

export const FontStyleSchema = z.object({
  weight: z.number().min(100).max(900).optional(),
  scale: z.number().min(0.3).max(6).optional(),
  tracking: z.number().min(-0.1).max(0.6).optional(),
  lineHeight: z.number().min(0.8).max(2.6).optional(),
  uppercase: z.boolean().optional(),
});

export type FontStyleSpec = z.infer<typeof FontStyleSchema>;

export const RecreatedTypeStylesSchema = z.object({
  fontFamily: looseFontFamily(),
  headlineFontFamily: looseFontFamily().optional(),
  baseSize: z.number().min(12).max(80).optional(),
  headline: FontStyleSchema.optional(),
  subtitle: FontStyleSchema.optional(),
  body: FontStyleSchema.optional(),
  cta: FontStyleSchema.optional(),
});

export type RecreatedTypeStyles = z.infer<typeof RecreatedTypeStylesSchema>;

export const RecreatedLayoutSchema = z.object({
  template: z
    .string()
    .nullish()
    .transform((value): RecreateTemplate => {
      const v = (value ?? "").toLowerCase();
      if (v.includes("split") || v.includes("two") || v.includes("side")) return "split_panel";
      if (v.includes("top") || v.includes("banner") || v.includes("stacked_image")) return "top_bottom";
      if (v.includes("card") || v.includes("inset") || v.includes("panel")) return "text_card";
      if (v.includes("grid") || v.includes("minimal") || v.includes("editorial")) return "minimal_grid";
      return "centered_stack";
    }),
  padding: z.number().min(20).max(220).optional(),
  gap: z.number().min(4).max(140).optional(),
  imagePlacement: z
    .string()
    .nullish()
    .transform((value): ImagePlacement => {
      const v = (value ?? "").toLowerCase();
      if (v.includes("back")) return "background";
      if (v.includes("side") || v.includes("right") || v.includes("left")) return "side";
      if (v.includes("bottom") || v.includes("below")) return "bottom";
      if (v.includes("top") || v.includes("above") || v.includes("hero")) return "top";
      return "none";
    }),
  ctaStyle: z
    .string()
    .nullish()
    .transform((value): CtaStyle => {
      const v = (value ?? "").toLowerCase();
      if (v.includes("rect") || v.includes("square") || v.includes("block")) return "rectangle";
      if (v.includes("link") || v.includes("underline") || v.includes("text")) return "text_link";
      return "pill";
    }),
  showDivider: z.boolean().optional(),
});

export type RecreateTemplate = "centered_stack" | "split_panel" | "top_bottom" | "text_card" | "minimal_grid";
export type ImagePlacement = "none" | "top" | "bottom" | "side" | "background";
export type CtaStyle = "pill" | "rectangle" | "text_link";

export const VisualElementEnum = z.enum([
  "logo",
  "product_image",
  "people",
  "icon",
  "shape",
  "line",
  "border",
  "card",
  "decorative",
  "background_graphic",
]);

export const VisualElementSchema = z.object({
  type: VisualElementEnum,
  description: looseString(240),
  placement: looseString(80),
});

export type VisualElement = z.infer<typeof VisualElementSchema>;

// --- Recreate & Compare: text-focused report ----------------------------
//
// Structured output for the "Recreate & Compare Post" feature: a
// per-element text assessment (case, alignment, status, reason), an
// "what improved" report that also records what was deliberately left
// unchanged, and an AI-generated design improvement summary.
//
// All three are optional so results produced before this feature (and
// any response where the model omits them) still validate — the UI
// falls back to the plain `improvements` list when they are absent.

/** Maps free-form model wording onto an assessment status. */
function looseStatus() {
  return z
    .string()
    .nullish()
    .transform((value): TextAssessmentStatus => {
      const v = (value ?? "").toLowerCase();
      if (v.includes("incorrect") || v.includes("wrong") || v.includes("error")) return "incorrect";
      if (v.includes("improve") || v.includes("change") || v.includes("warning") || v.includes("optional")) {
        return "improve";
      }
      return "correct";
    });
}

export type TextAssessmentStatus = "correct" | "improve" | "incorrect";

export const TextElementKindEnum = z.enum([
  "headline",
  "subtitle",
  "body",
  "cta",
  "label",
  "price",
  "contact",
  "website",
  "handle",
  "hashtags",
  "other",
]);

export type TextElementKind = z.infer<typeof TextElementKindEnum>;

export const TextElementAssessmentSchema = z.object({
  element: TextElementKindEnum,
  original: looseString(300),
  recommended: looseString(300),
  /** Current capitalization style, e.g. "Title Case", "Uppercase". */
  currentStyle: looseString(60),
  /** Recommended capitalization style for THIS element. */
  recommendedStyle: looseString(60),
  status: looseStatus(),
  reason: looseString(300),
  alignment: looseAlignment(),
  recommendedAlignment: looseAlignment(),
});

export type TextElementAssessment = z.infer<typeof TextElementAssessmentSchema>;

export const ImprovementCategoryEnum = z.enum([
  "capitalization",
  "alignment",
  "spacing",
  "hierarchy",
  "readability",
  "cta",
  "grammar",
  "other",
]);

export type ImprovementCategory = z.infer<typeof ImprovementCategoryEnum>;

/** §11 — distinguish a real problem from a preference from "already correct". */
export const ImprovementKindEnum = z.enum(["definite_problem", "design_improvement", "correct"]);

export type ImprovementKind = z.infer<typeof ImprovementKindEnum>;

function looseImprovementKind() {
  return z
    .string()
    .nullish()
    .transform((value): ImprovementKind => {
      const v = (value ?? "").toLowerCase();
      if (v.includes("problem") || v.includes("error") || v.includes("incorrect") || v.includes("definite")) {
        return "definite_problem";
      }
      if (v.includes("correct") || v.includes("appropriate") || v.includes("no change") || v.includes("keep")) {
        return "correct";
      }
      return "design_improvement";
    });
}

export const ImprovementItemSchema = z.object({
  category: ImprovementCategoryEnum,
  kind: looseImprovementKind(),
  /** Short label, e.g. "Capitalization". */
  title: looseString(80),
  /** What changed (or why it was kept) and whether it improves readability. */
  detail: looseString(320),
});

export type ImprovementItem = z.infer<typeof ImprovementItemSchema>;

export const DesignSummarySchema = z.object({
  overallImprovement: looseString(40),
  /** AI-generated assessment (0-100), not an objective measurement. */
  textAccuracy: z.number().min(0).max(100).optional(),
  alignment: looseString(60),
  capitalization: looseString(60),
  hierarchy: looseString(60),
  readability: looseString(60),
});

export type DesignSummary = z.infer<typeof DesignSummarySchema>;

export const RecreateResultSchema = z.object({
  title: looseString(200),
  format: PostFormatEnum.optional(),
  extractedText: RecreatedTextSchema.optional(),
  design: RecreatedDesignSchema.optional(),
  typography: RecreatedTypographySchema.optional(),
  typeStyles: RecreatedTypeStylesSchema.optional(),
  layout: RecreatedLayoutSchema.optional(),
  visualElements: z.array(VisualElementSchema).max(16).optional(),
  improvements: z.array(z.string().max(240)).max(12).optional(),
  textAnalysis: z.array(TextElementAssessmentSchema).max(14).optional(),
  improvementReport: z.array(ImprovementItemSchema).max(14).optional(),
  summary: DesignSummarySchema.optional(),
  notes: looseString(600),
  confidence: z.number().min(0).max(1).optional(),
});

export type RecreateResult = z.infer<typeof RecreateResultSchema>;

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
