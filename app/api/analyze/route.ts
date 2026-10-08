import { NextRequest, NextResponse } from "next/server";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL } from "@/lib/validation";
import { analyzeImageWithAi } from "@/lib/ai";
import { hasGeminiKey } from "@/lib/gemini";
import { apiFailure, apiFailureFrom, jsonFailure, jsonSuccess, sseResponse } from "@/lib/api-response";
import type { ApiProgressEvent } from "@/lib/errors";
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
  // Safe server-side configuration check — never reveals the key itself.
  if (!hasGeminiKey()) {
    return jsonFailure(apiFailure("MISSING_GEMINI_API_KEY"));
  }

  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  if (isRateLimited(ip)) {
    return jsonFailure(apiFailure("RATE_LIMITED"));
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonFailure(apiFailure("INVALID_UPLOAD", "We couldn't read that upload. Please try again."));
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonFailure(apiFailure("INVALID_UPLOAD", "No image file was provided."));
  }

  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return jsonFailure(apiFailure("INVALID_UPLOAD", "Please upload a JPG, PNG, or WEBP image."));
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return jsonFailure(
      apiFailure("INVALID_UPLOAD", `This image is too large. Please upload an image under ${MAX_FILE_SIZE_LABEL}.`)
    );
  }

  let base64Data: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    base64Data = buffer.toString("base64");
  } catch {
    return jsonFailure(
      apiFailure("INVALID_UPLOAD", "We couldn't process that image. Please try a different file.")
    );
  }

  const wantsStream = formData.get("stream") === "1";

  const runAnalysis = async (onProgress?: (event: ApiProgressEvent) => void): Promise<AnalysisResult> => {
    const analysis = await analyzeImageWithAi({ base64Data, mimeType: file.type, onProgress });

    return {
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
  };

  // Streaming mode: retry progress ("Retry attempt N/4") is pushed to the
  // client as server-sent events while the Gemini call runs.
  if (wantsStream) {
    return sseResponse(async (emit) => {
      try {
        const result = await runAnalysis((event) => emit("progress", event));

        if (!result.hasReadableText) {
          emit("result", {
            success: true,
            result,
            error: "We couldn't confidently detect readable text in this design.",
          });
          return;
        }

        emit("result", { success: true, result });
      } catch (err) {
        const failure = apiFailureFrom(err);
        emit("error", { ...failure.payload, status: failure.status });
      }
    });
  }

  try {
    const result = await runAnalysis();

    if (!result.hasReadableText) {
      return NextResponse.json(
        {
          error: "We couldn't confidently detect readable text in this design.",
          result,
        },
        { status: 200 }
      );
    }

    return jsonSuccess(result);
  } catch (err) {
    return jsonFailure(apiFailureFrom(err));
  }
}
