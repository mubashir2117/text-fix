export type OverallStatus = "correct" | "needs_improvement" | "incorrect";

export type AnalysisErrorVariant =
  | "busy"
  | "invalid"
  | "network"
  | "no-text"
  | "generic";

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
  role: string;
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
  confidence: number;
  qualityScore: number;
  ocrConfidence: number;
  extractedText: string;
  hasReadableText: boolean;
  issues: TextIssue[];
  correctedText: string;
  copyReview: CopyReview;
  notes?: string;
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
  | {
      status: "error";
      file: File | null;
      previewUrl: string | null;
      variant: AnalysisErrorVariant;
      message?: string;
    };