"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ListOrdered, RotateCcw, Wand2 } from "lucide-react";
import { UploadDropzone } from "@/components/upload-dropzone";
import { ImagePreview } from "@/components/image-preview";
import { RecreateLoader } from "@/components/recreate-loader";
import { RecreatePreview } from "@/components/recreate-preview";
import { PostFormatSelect } from "@/components/post-format-select";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { PasteScreenshotButton, useClipboardPaste } from "@/components/screenshot-paste";
import { normalizeRecreation } from "@/lib/formats";
import { takePendingPost } from "@/lib/recreate-store";
import {
  DEFAULT_RECREATE_SELECTION,
  type AnalysisResult,
  type ImageSource,
  type RecreateMode,
  type RecreateResult,
  type RecreateSelection,
  type RecreateState,
} from "@/lib/types";
import { friendlyApiErrorMessage } from "@/lib/utils";

/** Focus notes sent with "Improve design" (spec §37). */
const IMPROVE_FOCUS = [
  "spacing",
  "typography",
  "alignment",
  "contrast",
  "visual hierarchy",
  "CTA visibility",
];

const FLOW_STEPS = [
  "Upload",
  "Analyze design",
  "Extract text",
  "Check case + alignment",
  "Check spacing + hierarchy",
  "Recreate same post",
  "Compare original vs corrected",
  "Improve / Download",
];

function RecreatePageInner() {
  const [state, setState] = useState<RecreateState>({ status: "idle" });
  const searchParams = useSearchParams();
  const adoptedHandoffRef = useRef(false);

  const handleFileSelected = useCallback((file: File, source: ImageSource = "upload") => {
    const previewUrl = URL.createObjectURL(file);
    setState((current) => ({
      status: "ready",
      file,
      previewUrl,
      source,
      selection:
        current.status !== "idle" && current.selection
          ? current.selection
          : DEFAULT_RECREATE_SELECTION,
    }));
  }, []);

  // Adopt a file handed over from /analyze ("Recreate Post"), once.
  useEffect(() => {
    if (adoptedHandoffRef.current) return;
    adoptedHandoffRef.current = true;
    const pending = takePendingPost();
    if (pending) {
      setState({
        status: "ready",
        file: pending.file,
        previewUrl: pending.previewUrl,
        source: "upload",
        selection: pending.selection ?? DEFAULT_RECREATE_SELECTION,
      });
    }
  }, []);

  useClipboardPaste(
    useCallback((file: File) => handleFileSelected(file, "paste"), [handleFileSelected]),
    state.status === "idle"
  );

  useEffect(() => {
    if (searchParams.get("paste") === "1" && state.status === "idle") {
      toast.info("Press Ctrl+V (or Cmd+V on Mac) to paste your post.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const runRecreation = useCallback(
    async (options: {
      file: File;
      previewUrl: string;
      selection: RecreateSelection;
      mode: RecreateMode;
      previous?: RecreateResult;
      past?: RecreateResult[];
    }) => {
      const { file, previewUrl, selection, mode, previous, past = [] } = options;
      const fromResult = Boolean(previous);

      setState(
        fromResult && previous
          ? { status: "result", file, previewUrl, selection, result: previous, past, busy: mode }
          : { status: "recreating", file, previewUrl, selection, mode }
      );

      const backToResult = (message: string) => {
        if (fromResult && previous) {
          setState((current) => (current.status === "result" ? { ...current, busy: null } : current));
          toast.error(message);
        } else {
          setState({ status: "error", file, previewUrl, selection, message });
        }
      };

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("format", selection.format);
        formData.append("width", String(selection.customWidth));
        formData.append("height", String(selection.customHeight));
        formData.append("mode", mode);
        formData.append("variant", String(past.length + 1));
        if (previous) formData.append("previous", JSON.stringify(previous));
        if (mode === "improve") formData.append("improvements", JSON.stringify(IMPROVE_FOCUS));

        const response = await fetch("/api/recreate", { method: "POST", body: formData });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.result) {
          backToResult(
            friendlyApiErrorMessage(data, "Unable to analyze the design right now. Please try again.")
          );
          return;
        }

        const result = data.result as RecreateResult;
        setState({
          status: "result",
          file,
          previewUrl,
          selection,
          result,
          past: fromResult && previous ? [...past, previous] : [],
          busy: null,
        });
      } catch {
        backToResult("Connection problem. Please check your internet connection and try again.");
      }
    },
    []
  );

  const handleStartRecreation = useCallback(() => {
    if (state.status !== "ready") return;
    runRecreation({
      file: state.file,
      previewUrl: state.previewUrl,
      selection: state.selection,
      mode: "create",
    });
  }, [state, runRecreation]);

  const handleRegenerate = useCallback(() => {
    if (state.status !== "result") return;
    runRecreation({
      file: state.file,
      previewUrl: state.previewUrl,
      selection: state.selection,
      mode: "regenerate",
      previous: state.result,
      past: state.past,
    });
  }, [state, runRecreation]);

  const handleImprove = useCallback(() => {
    if (state.status !== "result") return;
    runRecreation({
      file: state.file,
      previewUrl: state.previewUrl,
      selection: state.selection,
      mode: "improve",
      previous: state.result,
      past: state.past,
    });
  }, [state, runRecreation]);

  const handleReset = useCallback(() => {
    setState((current) => {
      if (current.status !== "result" || current.past.length === 0) return current;
      const previous = current.past[current.past.length - 1];
      return { ...current, result: previous, past: current.past.slice(0, -1), busy: null };
    });
  }, []);

  const handleSelectionChange = useCallback((selection: RecreateSelection) => {
    setState((current) => {
      if (current.status === "idle") return current;
      return { ...current, selection } as RecreateState;
    });
  }, []);

  const handleStartOver = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const handleRetry = useCallback(() => {
    if (state.status === "error" && state.file && state.selection) {
      runRecreation({
        file: state.file,
        previewUrl: state.previewUrl ?? "",
        selection: state.selection,
        mode: "create",
      });
      return;
    }
    setState({ status: "idle" });
  }, [state, runRecreation]);

  /**
   * Fix text — runs the existing text analysis on the same upload and
   * applies the corrected copy onto the recreated design's hierarchy
   * without touching the design itself.
   */
  const handleFixText = useCallback(async () => {
    if (state.status !== "result") return;
    const { file, previewUrl, selection, result, past } = state;
    setState({ ...state, busy: "fix" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await response.json().catch(() => null);
      const analysis = data?.result as AnalysisResult | undefined;

      if (!analysis || !analysis.hasReadableText) {
        toast.error(
          friendlyApiErrorMessage(data, "We couldn't confidently detect readable text in this design.")
        );
        setState((current) => (current.status === "result" ? { ...current, busy: null } : current));
        return;
      }

      const blocks = analysis.textBlocks ?? [];
      const pick = (roles: string[]): string => {
        const normalized = roles.map((role) => role.toLowerCase());
        const exact = blocks.find((block) => normalized.includes(block.role.trim().toLowerCase()));
        if (exact?.text?.trim()) return exact.text.trim();
        const loose = blocks.find((block) =>
          normalized.some((role) => block.role.trim().toLowerCase().includes(role))
        );
        return loose?.text?.trim() ?? "";
      };

      const correctedBody = analysis.correctedText?.trim() ?? "";
      const currentText = result.extractedText ?? {
        headline: "",
        subtitle: "",
        body: "",
        cta: "",
        label: "",
        price: "",
        contact: "",
        website: "",
        handle: "",
        hashtags: "",
      };
      const nextText = {
        ...currentText,
        headline: pick(["headline", "title", "h1", "main title"]) || currentText.headline,
        subtitle:
          pick(["subtitle", "subheadline", "sub heading", "heading", "tagline"]) ||
          currentText.subtitle,
        body:
          pick(["body", "paragraph", "text", "description", "content"]) ||
          (blocks.length === 0 && correctedBody ? correctedBody : currentText.body),
        cta: pick(["cta", "call to action", "action", "button"]) || currentText.cta,
        label: pick(["label", "eyebrow", "kicker", "brand"]) || currentText.label,
      };

      setState({
        status: "result",
        file,
        previewUrl,
        selection,
        past: [...past, result],
        busy: null,
        result: {
          ...result,
          extractedText: nextText,
        },
      });
      toast.success("Corrected copy applied to your design.");
    } catch {
      toast.error("Connection problem. Please check your internet connection and try again.");
      setState((current) => (current.status === "result" ? { ...current, busy: null } : current));
    }
  }, [state]);

  const recreation = useMemo(
    () => (state.status === "result" ? normalizeRecreation(state.result, state.selection.format) : null),
    [state]
  );

  return (
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">Recreate &amp; compare post</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">
            Upload an existing post. AI recreates the same design — same layout, background, visuals
            and colors — while checking and improving the text: capitalization, alignment, spacing,
            hierarchy and readability. Then compare original vs corrected side by side.
          </p>
        </div>
        {state.status !== "idle" && (
          <Button variant="ghost" size="sm" onClick={handleStartOver}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Start over
          </Button>
        )}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-1.5">
        <ListOrdered className="mr-1 h-3.5 w-3.5 text-ink-faint" aria-hidden="true" />
        {FLOW_STEPS.map((step, index) => (
          <span key={step} className="flex items-center gap-1.5">
            <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-soft">
              {step}
            </span>
            {index < FLOW_STEPS.length - 1 && (
              <span className="text-[11px] text-ink-faint" aria-hidden>
                →
              </span>
            )}
          </span>
        ))}
      </div>

      {state.status === "idle" && (
        <div className="flex flex-col gap-4">
          <UploadDropzone onFileSelected={(file) => handleFileSelected(file, "upload")} />
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <PasteScreenshotButton onImage={(file) => handleFileSelected(file, "paste")} />
            <span className="text-xs text-ink-faint">
              Tip: you can paste a screenshot directly with Ctrl+V (Cmd+V on Mac)
            </span>
          </div>
        </div>
      )}

      {state.status === "ready" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-sm lg:max-w-none">
            <ImagePreview src={state.previewUrl} />
            {state.source === "paste" && (
              <p className="mt-2 text-center text-sm font-medium text-approve">Screenshot pasted ✓</p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-card border border-line bg-surface p-4">
              <p className="text-sm font-medium text-ink">Ready to recreate</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                The AI keeps the original layout, background, colors and visuals, extracts every piece
                of text, checks sentence case / Title Case / uppercase, alignment, spacing and
                hierarchy, and returns a corrected version beside the original with a report of
                exactly what improved — and what was correctly left unchanged.
              </p>
            </div>

            <PostFormatSelect value={state.selection} onChange={handleSelectionChange} />

            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={handleStartOver}>
                Choose a different image
              </Button>
              <Button onClick={handleStartRecreation}>
                <Wand2 className="h-4 w-4" aria-hidden="true" />
                Recreate post
              </Button>
            </div>
          </div>
        </div>
      )}

      {state.status === "recreating" && (
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <div className="mx-auto w-full max-w-[240px] shrink-0 sm:mx-0">
            <ImagePreview src={state.previewUrl} />
          </div>
          <div className="w-full max-w-2xl flex-1">
            <RecreateLoader />
          </div>
        </div>
      )}

      {state.status === "result" && recreation && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="rounded-card border border-line bg-paper-dim/50 px-4 py-2.5 text-sm text-ink-soft">
              Recreated from <span className="font-medium text-ink">{state.file.name}</span> — same
              design, corrected text presentation.
            </p>
            <PostFormatSelect value={state.selection} onChange={handleSelectionChange} />
          </div>

          <RecreatePreview
            originalUrl={state.previewUrl}
            recreation={recreation}
            selection={state.selection}
            busy={state.busy}
            canReset={state.past.length > 0}
            onRegenerate={handleRegenerate}
            onImprove={handleImprove}
            onFixText={handleFixText}
            onReset={handleReset}
          />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-col items-center gap-6">
          {state.previewUrl && (
            <div className="w-full max-w-sm opacity-70">
              <ImagePreview src={state.previewUrl} />
            </div>
          )}
          <ErrorState
            message={state.message}
            reassurance={Boolean(state.file)}
            onRetry={state.file ? handleRetry : undefined}
            onChooseAnother={handleStartOver}
          />
        </div>
      )}
    </div>
  );
}

export default function RecreatePage() {
  return (
    <Suspense fallback={null}>
      <RecreatePageInner />
    </Suspense>
  );
}
