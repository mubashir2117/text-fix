import { NextRequest, NextResponse } from "next/server";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/validation";
import { analyzeImageWithAi, AiAnalysisError } from "@/lib/ai";
import type { AnalysisResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- Minimal in-memory rate limiting -----------------------------------
// Suitable as a starting point / architecture placeholder. On Vercel's
// serverless platform this resets per-instance; swap in Upstash Redis
// or similar for real distributed rate limiting in production.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "We couldn't read that upload. Please try again." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file was provided." }, { status: 400 });
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Please upload a JPG, PNG, or WEBP image." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "This image is too large. Please upload a smaller file." }, { status: 400 });
  }

  let base64Data: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    base64Data = buffer.toString("base64");
  } catch {
    return NextResponse.json({ error: "We couldn't process that image. Please try a different file." }, { status: 400 });
  }

  try {
    const analysis = await analyzeImageWithAi({ base64Data, mimeType: file.type });

    const result: AnalysisResult = {
      overallStatus: analysis.overallStatus,
      confidence: analysis.confidence,
      qualityScore: analysis.qualityScore,
      ocrConfidence: analysis.ocrConfidence,
      extractedText: analysis.extractedText,
      hasReadableText: analysis.hasReadableText,
      issues: analysis.issues.map((issue, index) => ({ id: `issue-${index}`, ...issue })),
      correctedText: analysis.correctedText,
      copyReview: analysis.copyReview,
      notes: analysis.notes,
      textBlocks: analysis.textBlocks,
      keywordAnalysis: analysis.keywordAnalysis,
      caseAnalysis: analysis.caseAnalysis,
    };

    if (!result.hasReadableText) {
      return NextResponse.json(
        {
          error: "We couldn't confidently detect readable text in this design.",
          result,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ result }, { status: 200 });
  } catch (err) {
    if (err instanceof AiAnalysisError) {
      console.error("AI analysis failed:", err.message, err.cause);
      return NextResponse.json(
        { error: "Something went wrong while analyzing your design. Please try again." },
        { status: 502 }
      );
    }
    console.error("Unexpected error in /api/analyze:", err);
    return NextResponse.json(
      { error: "Something went wrong while analyzing your design. Please try again." },
      { status: 500 }
    );
  }
}
