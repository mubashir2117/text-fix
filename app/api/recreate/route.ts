import { NextRequest, NextResponse } from "next/server";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE_BYTES, PostFormatEnum, RecreateResultSchema } from "@/lib/validation";
import { hasGeminiKey } from "@/lib/gemini";
import { RecreateError, recreatePostWithAi, type RecreateMode } from "@/lib/recreate";
import { clampCustomDimension, getPostFormat } from "@/lib/formats";
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

const MISSING_KEY_PAYLOAD = {
  error: "Gemini API key is not configured.",
  code: "missing_api_key",
} as const;

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
    return NextResponse.json(MISSING_KEY_PAYLOAD, { status: 503 });
  }

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
    return NextResponse.json({ error: "We couldn't process that image. Please try a different file." }, { status: 400 });
  }

  try {
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
    });

    // The requested format always wins over anything the model echoed.
    result.format = format;

    const hasText = Object.values(result.extractedText ?? {}).some((value) => value.trim().length > 0);
    if (!hasText) {
      return NextResponse.json(
        { error: "We couldn't confidently detect readable text in this design." },
        { status: 422 }
      );
    }

    return NextResponse.json({ result }, { status: 200 });
  } catch (err) {
    if (err instanceof RecreateError) {
      if (err.message === "Gemini API key is not configured.") {
        return NextResponse.json(MISSING_KEY_PAYLOAD, { status: 503 });
      }
      console.error("[recreate] request failed:", err.message, err.cause);
      return NextResponse.json(
        { error: "Unable to analyze the design right now. Please try again." },
        { status: 502 }
      );
    }
    console.error("Unexpected error in /api/recreate:", err);
    return NextResponse.json(
      { error: "Unable to analyze the design right now. Please try again." },
      { status: 500 }
    );
  }
}
