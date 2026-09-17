"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { UploadZone } from "@/components/upload-zone";
import { ImagePreview } from "@/components/image-preview";
import { AnalysisLoader } from "@/components/analysis-loader";
import { AnalysisResultView } from "@/components/analysis-result";
import { AnalysisError } from "@/components/analysis-error";
import { Button } from "@/components/ui/button";
import { PasteScreenshotButton, useClipboardPaste } from "@/components/screenshot-paste";
import { ScanLine, RotateCcw, Sparkles } from "lucide-react";
import type {
  AnalysisResult,
  AppState,
  ImageSource,
  AnalysisErrorVariant,
} from "@/lib/types";
import { fileToDataUrl, formatBytes } from "@/lib/utils";
import { saveHistoryEntry } from "@/lib/history";
import { DEMO_IMAGE_SRC, DEMO_FILE_NAME, DEMO_RESULT } from "@/lib/demo";

function AnalyzePageInner() {
  const [state, setState] = useState<AppState>({ status: "idle" });
  const searchParams = useSearchParams();

  const runAnalysis = useCallback(async (file: File, previewUrl: string) => {
    setState({ status: "analyzing", previewUrl, stage: 0 });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.result) {
        const status = response.status;
        let variant: AnalysisErrorVariant = "generic";
        if (status === 429 || status >= 500) variant = "busy";
        else if (status === 400) variant = "invalid";
        setState({
          status: "error",
          file,
          previewUrl,
          variant,
          message: data?.error,
        });
        return;
      }

      const result = data.result as AnalysisResult;

      if (!result.hasReadableText) {
        setState({ status: "error", file, previewUrl, variant: "no-text" });
        return;
      }

      setState({ status: "result", previewUrl, result, fileName: file.name });

      const thumbnailDataUrl = await fileToDataUrl(file).catch(() => previewUrl);
      saveHistoryEntry({ fileName: file.name, thumbnailDataUrl, result });
    } catch {
      setState({ status: "error", file, previewUrl, variant: "network" });
    }
  }, []);

  const handleFileSelected = useCallback((file: File, source: ImageSource = "upload") => {
    const previewUrl = URL.createObjectURL(file);
    setState({ status: "preview", file, previewUrl, source });
  }, []);

  useClipboardPaste(
    useCallback((file: File) => handleFileSelected(file, "paste"), [handleFileSelected]),
    state.status === "idle"
  );

  const handleAnalyzeClick = useCallback(() => {
    if (state.status !== "preview") return;
    runAnalysis(state.file, state.previewUrl);
  }, [state, runAnalysis]);

  const handleReset = useCallback(() => {
    setState({ status: "idle" });
  }, []);

  const handleErrorPrimary = useCallback(() => {
    if (
      state.status === "error" &&
      (state.variant === "busy" || state.variant === "network" || state.variant === "generic") &&
      state.file &&
      state.previewUrl
    ) {
      runAnalysis(state.file, state.previewUrl);
      return;
    }
    handleReset();
  }, [state, runAnalysis, handleReset]);

  const handleTryExample = useCallback(async () => {
    setState({ status: "analyzing", previewUrl: DEMO_IMAGE_SRC, stage: 0 });
    await new Promise((resolve) => setTimeout(resolve, 2200));
    setState({
      status: "result",
      previewUrl: DEMO_IMAGE_SRC,
      result: DEMO_RESULT,
      fileName: DEMO_FILE_NAME,
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("demo") === "1" && state.status === "idle") {
      handleTryExample();
    }
    if (searchParams.get("paste") === "1" && state.status === "idle") {
      toast.info("Press Ctrl+V (or Cmd+V on Mac) to paste your screenshot.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-serif text-4xl leading-tight tracking-tight text-ink sm:text-5xl">
          Is your design copy correct?
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
          Upload your design and let AI check spelling, grammar, capitalization, clarity and
          marketing copy.
        </p>
      </div>

      {state.status === "idle" && (
        <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-6">
          <UploadZone onFileSelected={(file) => handleFileSelected(file, "upload")} />

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <PasteScreenshotButton onImage={(file) => handleFileSelected(file, "paste")} />
            <span className="text-xs text-ink-faint">
              Tip: paste a screenshot directly with Ctrl+V (Cmd+V on Mac)
            </span>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-sm text-ink-soft">
            <span>Don't have a design handy?</span>
            <button
              type="button"
              onClick={handleTryExample}
              className="inline-flex items-center gap-1 font-medium text-ink underline-offset-4 hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Try an example
            </button>
          </div>
        </div>
      )}

      {state.status === "preview" && (
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <ImagePreview src={state.previewUrl} alt={`Uploaded design ${state.file.name}`} />
            <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-ink-faint">
              <span className="truncate">{state.file.name}</span>
              <span className="shrink-0">{formatBytes(state.file.size)}</span>
            </div>
            {state.source === "paste" && (
              <p className="mt-2 px-1 text-xs font-medium text-approve">Screenshot pasted</p>
            )}
          </div>

          <div className="rounded-panel border border-line bg-surface p-6 shadow-desk animate-fade-in sm:p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper">
              <ScanLine className="h-5 w-5 text-ink" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-ink">
              Ready to analyze
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              We'll read the visible text and check spelling, grammar, capitalization, clarity,
              and marketing copy — then give you a corrected version.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleAnalyzeClick} className="flex-1">
                Analyze Design
              </Button>
              <Button variant="secondary" onClick={handleReset} className="flex-1 sm:flex-none">
                Choose a different image
              </Button>
            </div>
          </div>
        </div>
      )}

      {state.status === "analyzing" && (
        <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          {state.previewUrl && (
            <div className="order-first lg:sticky lg:top-24">
              <ImagePreview src={state.previewUrl} className="opacity-90" />
            </div>
          )}
          <div>
            <AnalysisLoader />
          </div>
        </div>
      )}

      {state.status === "result" && (
        <div className="mt-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-faint">
              {state.fileName === DEMO_FILE_NAME ? "Showing example results." : `Results for ${state.fileName}`}
            </p>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              New analysis
            </Button>
          </div>
          <AnalysisResultView previewUrl={state.previewUrl} result={state.result} />
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-10 flex flex-col items-center gap-8">
          {state.previewUrl && (
            <div className="w-full max-w-sm">
              <ImagePreview src={state.previewUrl} className="opacity-90" />
            </div>
          )}
          <AnalysisError
            variant={state.variant}
            onPrimary={handleErrorPrimary}
            onSecondary={handleReset}
          />
        </div>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={null}>
      <AnalyzePageInner />
    </Suspense>
  );
}