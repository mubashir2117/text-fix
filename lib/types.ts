export type OverallStatus = "correct" | "needs_improvement" | "incorrect";

export type IssueType =
  | "spelling"
  | "grammar"
  | "punctuation"
  | "capitalization"
  | "wording"
  | "structure"
  | "clarity"
  | "duplication"
  | "cta"
  | "other";

export type Severity = "critical" | "high" | "medium" | "low";

export interface TextIssue {
  id: string;
  type: IssueType;
  severity: Severity;
  original: string;
  correction: string;
  explanation: string;
  /** Optional finer-grained label, e.g. "sentence_case" under type "capitalization". */
  category?: string;
}

export interface CopyReview {
  hook: string;
  clarity: string;
  valueProposition: string;
  cta: string;
  readability: string;
  conciseness: string;
  tone: string;
  overall: string;
}

export type CaseStyle = "sentence_case" | "title_case" | "all_caps" | "lowercase" | "mixed_case";

export interface TextBlock {
  text: string;
  role: string; // "headline" | "subheadline" | "body" | "cta" | "label" | ...
  caseStyle: CaseStyle;
}

export interface KeywordAnalysisEntry {
  keyword: string;
  detectedVariants: string[];
  recommendedForm: string;
  consistent: boolean;
}

export type CaseCheck = "pass" | "warning" | "fail";

export interface CaseAnalysis {
  detectedStyles: CaseStyle[];
  sentenceCase: CaseCheck;
  titleCase: CaseCheck;
  keywordCapitalization: CaseCheck;
  properNouns: CaseCheck;
  overall: CaseCheck;
}

export interface AnalysisResult {
  overallStatus: OverallStatus;
  confidence: number; // 0 to 1
  qualityScore: number; // 0 to 100
  ocrConfidence: number; // 0 to 1
  extractedText: string;
  hasReadableText: boolean;
  issues: TextIssue[];
  correctedText: string;
  copyReview: CopyReview;
  notes?: string;
  // Additive: case/capitalization + keyword-consistency analysis.
  // Optional so history entries saved before these fields existed
  // still render (components check for presence before rendering).
  textBlocks?: TextBlock[];
  keywordAnalysis?: KeywordAnalysisEntry[];
  caseAnalysis?: CaseAnalysis;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  fileName: string;
  thumbnailDataUrl: string;
  result: AnalysisResult;
}

export type ImageSource = "upload" | "paste";

export type AppState =
  | { status: "idle" }
  | { status: "preview"; file: File; previewUrl: string; source: ImageSource }
  | { status: "analyzing"; previewUrl: string; stage: number }
  | { status: "result"; previewUrl: string; result: AnalysisResult; fileName: string }
  | { status: "error"; file: File | null; previewUrl: string | null; message: string };

// --- "Recreate This Post" feature ---------------------------------------

export type {
  PostFormatId,
  TextAlignment,
  RecreateTemplate,
  ImagePlacement,
  CtaStyle,
  VisualElement,
  RecreateResult,
  RecreatedText,
  RecreatedDesign,
  RecreatedTypography,
  TextElementAssessment,
  TextAssessmentStatus,
  TextElementKind,
  ImprovementItem,
  ImprovementCategory,
  ImprovementKind,
  DesignSummary,
} from "./validation";

import type { PostFormatId, RecreateResult } from "./validation";

/** What the recreate flow is currently asking the server to do. */
export type RecreateMode = "create" | "regenerate" | "improve";

/** Post-format selection carried across the recreate flow. */
export interface RecreateSelection {
  format: PostFormatId;
  customWidth: number;
  customHeight: number;
}

export const DEFAULT_RECREATE_SELECTION: RecreateSelection = {
  format: "instagram_portrait",
  customWidth: 1080,
  customHeight: 1350,
};

/** Which generation-style action is currently running on the result view. */
export type RecreateBusyAction = RecreateMode | "fix" | "download" | null;

/**
 * Page state machine for /recreate — mirrors AppState on the analyze
 * page: idle -> ready -> recreating -> result (with reset/regenerate
 * cycling back through `past`), plus a recoverable error state.
 */
export type RecreateState =
  | { status: "idle" }
  | {
      status: "ready";
      file: File;
      previewUrl: string;
      source: ImageSource;
      selection: RecreateSelection;
    }
  | {
      status: "recreating";
      file: File;
      previewUrl: string;
      selection: RecreateSelection;
      mode: RecreateMode;
    }
  | {
      status: "result";
      file: File;
      previewUrl: string;
      selection: RecreateSelection;
      result: RecreateResult;
      /** Previous versions, newest last — powers the Reset action. */
      past: RecreateResult[];
      busy: RecreateBusyAction;
    }
  | {
      status: "error";
      file: File | null;
      previewUrl: string | null;
      selection?: RecreateSelection;
      message: string;
    };
