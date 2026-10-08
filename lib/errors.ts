/**
 * Shared API error contract.
 *
 * Every API failure is returned as:
 *   { "success": false, "error": { "code": "...", "message": "..." } }
 *
 * This module is client-safe: no server-only imports, no environment access.
 */

export type GeminiErrorCode =
  | "MISSING_GEMINI_API_KEY"
  | "GEMINI_AUTH_FAILED"
  | "GEMINI_ACCESS_DENIED"
  | "GEMINI_MODEL_NOT_FOUND"
  | "GEMINI_BAD_REQUEST"
  | "GEMINI_RATE_LIMITED"
  | "GEMINI_TIMEOUT"
  | "GEMINI_INTERNAL_ERROR"
  | "GEMINI_SERVICE_UNAVAILABLE"
  | "GEMINI_NETWORK_ERROR"
  | "GEMINI_INVALID_RESPONSE";

export type ApiErrorCode =
  | GeminiErrorCode
  | "INVALID_UPLOAD"
  | "NO_READABLE_TEXT"
  | "RATE_LIMITED"
  | "UNEXPECTED_ERROR";

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

export interface ApiErrorPayload {
  success: false;
  error: ApiErrorBody;
}

export interface ApiSuccessPayload<T> {
  success: true;
  result: T;
}

/** Progress emitted while the server retries transient Gemini failures. */
export interface ApiProgressEvent {
  /** 1-based count of the retry that is about to run (max `maxRetries`). */
  retry: number;
  maxRetries: number;
  code?: ApiErrorCode;
  /** Safe, user-facing status shown while waiting for the retry. */
  message?: string;
  /** Milliseconds until the next attempt. */
  delayMs?: number;
}

/** Final, user-safe messages for every error code (spec §9). */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  MISSING_GEMINI_API_KEY: "Gemini API is not configured on the server.",
  GEMINI_AUTH_FAILED: "Gemini authentication failed. Check the server API key.",
  GEMINI_ACCESS_DENIED: "Gemini API access is not permitted for this project.",
  GEMINI_MODEL_NOT_FOUND:
    "The configured Gemini model was not found. Please check GEMINI_MODEL.",
  GEMINI_BAD_REQUEST: "Gemini rejected the request as invalid. Please try again.",
  GEMINI_RATE_LIMITED: "Gemini usage limit has been reached. Please try again shortly.",
  GEMINI_TIMEOUT: "Gemini took too long to respond. Please try again.",
  GEMINI_INTERNAL_ERROR: "Gemini returned an internal error. Please try again.",
  GEMINI_SERVICE_UNAVAILABLE:
    "Gemini is currently unavailable. Please try again in a few moments.",
  GEMINI_NETWORK_ERROR: "Unable to reach Gemini. Please check the connection and try again.",
  GEMINI_INVALID_RESPONSE: "Gemini returned an invalid analysis response. Please try again.",
  INVALID_UPLOAD: "The upload could not be processed. Please try a different image.",
  NO_READABLE_TEXT: "We couldn't confidently detect readable text in this design.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  UNEXPECTED_ERROR: "Something went wrong. Please try again.",
};

/** User-facing status shown while a transient error is being retried (spec §9). */
export const RETRY_MESSAGES: Partial<Record<GeminiErrorCode, string>> = {
  GEMINI_RATE_LIMITED: "Gemini usage limit reached. Retrying shortly...",
  GEMINI_SERVICE_UNAVAILABLE: "Gemini is temporarily unavailable. Retrying automatically...",
  GEMINI_TIMEOUT: "Gemini is taking too long. Retrying automatically...",
  GEMINI_NETWORK_ERROR: "Connection to Gemini dropped. Retrying automatically...",
  GEMINI_INTERNAL_ERROR: "Gemini hit an internal error. Retrying automatically...",
  GEMINI_INVALID_RESPONSE: "Gemini returned an invalid response. Retrying...",
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(message: string, code: ApiErrorCode, cause?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.cause = cause;
  }
}

export function apiError(code: ApiErrorCode, message: string): ApiErrorPayload {
  return { success: false, error: { code, message } };
}

/** HTTP status used for each error code when returned from a route handler. */
export function apiStatusForCode(code: ApiErrorCode): number {
  switch (code) {
    case "MISSING_GEMINI_API_KEY":
      // Server misconfiguration — not a transient outage, so 500 (spec §2).
      return 500;
    case "INVALID_UPLOAD":
    case "GEMINI_BAD_REQUEST":
      return 400;
    case "NO_READABLE_TEXT":
      return 422;
    case "RATE_LIMITED":
    case "GEMINI_RATE_LIMITED":
      return 429;
    case "GEMINI_SERVICE_UNAVAILABLE":
      return 503;
    case "GEMINI_TIMEOUT":
      return 504;
    case "UNEXPECTED_ERROR":
      return 500;
    default:
      return 502;
  }
}

export function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === "string" && value in ERROR_TITLES;
}

export interface ParsedApiError {
  code?: ApiErrorCode;
  message?: string;
}

/** Reads an error out of any JSON payload we may receive (new or legacy shape). */
export function readApiError(payload: unknown): ParsedApiError {
  if (!payload || typeof payload !== "object") return {};
  const data = payload as Record<string, unknown>;

  const nested = data.error;
  if (nested && typeof nested === "object") {
    const body = nested as Record<string, unknown>;
    const code = typeof body.code === "string" ? body.code : undefined;
    const message =
      typeof body.message === "string" && body.message.trim().length > 0
        ? body.message
        : undefined;
    if (code || message) {
      return { code: code && isApiErrorCode(code) ? code : undefined, message };
    }
  }

  const legacyCode =
    typeof data.code === "string"
      ? data.code === "missing_api_key"
        ? "MISSING_GEMINI_API_KEY"
        : data.code
      : undefined;
  const legacyMessage =
    typeof nested === "string" && nested.trim().length > 0 ? nested : undefined;

  return {
    code: legacyCode && isApiErrorCode(legacyCode) ? legacyCode : undefined,
    message: legacyMessage,
  };
}

export const ERROR_TITLES: Record<ApiErrorCode, string> = {
  MISSING_GEMINI_API_KEY: "AI service is not configured",
  GEMINI_AUTH_FAILED: "Gemini authentication failed",
  GEMINI_ACCESS_DENIED: "Gemini access not permitted",
  GEMINI_MODEL_NOT_FOUND: "Gemini model not found",
  GEMINI_BAD_REQUEST: "Request rejected",
  GEMINI_RATE_LIMITED: "AI usage limit reached",
  GEMINI_TIMEOUT: "The AI service timed out",
  GEMINI_INTERNAL_ERROR: "Gemini internal error",
  GEMINI_SERVICE_UNAVAILABLE: "Gemini is currently unavailable",
  GEMINI_NETWORK_ERROR: "Connection problem",
  GEMINI_INVALID_RESPONSE: "Invalid AI response",
  INVALID_UPLOAD: "Invalid upload",
  NO_READABLE_TEXT: "No readable text found",
  RATE_LIMITED: "Too many requests",
  UNEXPECTED_ERROR: "Something went wrong",
};

export function friendlyApiErrorTitle(payload: unknown, fallback: string): string {
  const { code } = readApiError(payload);
  if (code && ERROR_TITLES[code]) return ERROR_TITLES[code];
  return fallback;
}

export function friendlyApiErrorMessage(payload: unknown, fallback: string): string {
  const { code, message } = readApiError(payload);

  if (code === "MISSING_GEMINI_API_KEY") {
    return "Gemini API is not configured on the server.";
  }
  if (message && message.trim().length > 0) return message;
  return fallback;
}
