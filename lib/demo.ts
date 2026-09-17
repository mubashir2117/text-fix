import type { AnalysisResult } from "./types";

export const DEMO_IMAGE_SRC = "/demo/example.svg";
export const DEMO_FILE_NAME = "example-ad.svg";

export const DEMO_RESULT: AnalysisResult = {
  overallStatus: "incorrect",
  confidence: 0.91,
  qualityScore: 58,
  ocrConfidence: 0.97,
  hasReadableText: true,
  extractedText:
    "Grow your business with right solution. Trusted by 10,000+ small teams worldwide. Get started Today brightpath.io/start",
  issues: [
    {
      id: "issue-0",
      type: "grammar",
      severity: "high",
      original: "Grow your business with right solution.",
      correction: "Grow your business with the right solution.",
      explanation: "An article (\"the\") is missing before \"right solution,\" which makes the headline read as a fragment.",
    },
    {
      id: "issue-1",
      type: "capitalization",
      category: "sentence_case",
      severity: "low",
      original: "Get started Today",
      correction: "Get Started Today",
      explanation: "Capitalization is inconsistent with the surrounding headline style — \"Today\" is capitalized but \"Get started\" is not.",
    },
    {
      id: "issue-2",
      type: "cta",
      severity: "medium",
      original: "Get started Today",
      correction: "Start your free trial",
      explanation: "The current CTA is generic. A more specific action tells people exactly what happens when they tap it.",
    },
  ],
  textBlocks: [
    { text: "Grow your business with right solution.", role: "headline", caseStyle: "sentence_case" },
    { text: "Trusted by 10,000+ small teams worldwide", role: "subheadline", caseStyle: "sentence_case" },
    { text: "Get started Today", role: "cta", caseStyle: "mixed_case" },
  ],
  keywordAnalysis: [
    {
      keyword: "brightpath",
      detectedVariants: ["brightpath.io/start"],
      recommendedForm: "brightpath.io/start",
      consistent: true,
    },
  ],
  caseAnalysis: {
    detectedStyles: ["sentence_case", "mixed_case"],
    sentenceCase: "pass",
    titleCase: "pass",
    keywordCapitalization: "pass",
    properNouns: "pass",
    overall: "pass",
  },
  correctedText:
    "Grow your business with the right solution. Trusted by 10,000+ small teams worldwide. Get Started Today — brightpath.io/start",
  copyReview: {
    hook: "The headline states a clear benefit but the missing article weakens its polish.",
    clarity: "The message is understandable, though the grammar slip is distracting on a first read.",
    valueProposition: "The social-proof line (10,000+ teams) gives a concrete reason to trust the brand.",
    cta: "\"Get started Today\" works, but a more specific verb phrase would convert better.",
    readability: "Short lines and a simple structure make this easy to scan at a glance.",
    conciseness: "The copy is appropriately brief for a square ad format.",
    tone: "Confident and direct, consistent with a B2B software audience.",
    overall: "A solid layout held back by one grammar slip and a generic call to action — both easy fixes.",
  },
  notes: "This is example content used for demo mode.",
};
