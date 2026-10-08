import { NextRequest, NextResponse } from "next/server";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_LABEL, PostFormatEnum, RecreateResultSchema } from "@/lib/validation";
import { hasGeminiKey } from "@/lib/gemini";
import { recreatePostWithAi, type RecreateMode } from "@/lib/recreate";
import { clampCustomDimension, getPostFormat } from "@/lib/formats";
import { apiFailure, apiFailureFrom, jsonFailure, jsonSuccess, sseResponse } from "@/lib/api-response";
import type { ApiProgressEvent } from "@/lib/errors";
import type { PostFormatId, RecreateResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// --- Minimal in-memory rate limiting -----------------------------------
// Same architecture note as /api/analyze: resets per serverless
// instance; swap for a distributed store (e.g. Upstash Redis) for real
// production traffic. Isolated in one function to make that swap easy.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return timestamps.length > RATE_LIMIT_MAX_REQUESTS;
}

function parseMode(value: FormDataEntryValue | null): RecreateMode {
  return value === "regenerate" || value === "improve" ? value : "create";
}

function parseVariant(value: FormDataEntryValue | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(20, Math.round(parsed));
}

function parsePrevious(value: FormDataEntryValue | null): RecreateResult | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  try {
    const parsed = RecreateResultSchema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

function parseDimension(value: FormDataEntryValue | null, fallback: number): number {
  if (value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clampCustomDimension(parsed);
}

function parseImprovements(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || value.trim().length === 0) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string").slice(0, 12);
    }
  } catch {
    // ignore malformed focus notes — improve mode falls back to defaults
  }
  return [];
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

  const formatParse = PostFormatEnum.safeParse(formData.get("format"));
  const format: PostFormatId = formatParse.success ? formatParse.data : "instagram_portrait";

  const baseFormat = getPostFormat(format);
  const width =
    format === "custom"
      ? parseDimension(formData.get("width"), baseFormat.width)
      : baseFormat.width;
  const height =
    format === "custom"
      ? parseDimension(formData.get("height"), baseFormat.height)
      : baseFormat.height;

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

  const runRecreation = async (onProgress?: (event: ApiProgressEvent) => void): Promise<RecreateResult> => {
    const result = await recreatePostWithAi({
      base64Data,
      mimeType: file.type,
      format,
      width,
      height,
      mode: parseMode(formData.get("mode")),
      variant: parseVariant(formData.get("variant")),
      previous: parsePrevious(formData.get("previous")),
      improvements: parseImprovements(formData.get("improvements")),
      onProgress,
    });

    // The requested format always wins over anything the model echoed.
    result.format = format;
    return result;
  };

  // Streaming mode: retry progress ("Retry attempt N/4") is pushed to the
  // client as server-sent events while the Gemini call runs.
  if (wantsStream) {
    return sseResponse(async (emit) => {
      try {
        const result = await runRecreation((event) => emit("progress", event));

        const hasText = Object.values(result.extractedText ?? {}).some((value) => value.trim().length > 0);
        if (!hasText) {
          const failure = apiFailure("NO_READABLE_TEXT");
          emit("error", { ...failure.payload, status: failure.status });
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
    const result = await runRecreation();

    const hasText = Object.values(result.extractedText ?? {}).some((value) => value.trim().length > 0);
    if (!hasText) {
      return jsonFailure(apiFailure("NO_READABLE_TEXT"));
    }

    return jsonSuccess(result);
  } catch (err) {
    return jsonFailure(apiFailureFrom(err));
  }
}
