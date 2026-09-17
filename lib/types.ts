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
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  fileName: string;
  thumbnailDataUrl: string;
  result: AnalysisResult;
}

export type AppState =
  | { status: "idle" }
  | { status: "preview"; file: File; previewUrl: string }
  | { status: "analyzing"; previewUrl: string; stage: number }
  | { status: "result"; previewUrl: string; result: AnalysisResult; fileName: string }
  | { status: "error"; previewUrl: string | null; message: string };
