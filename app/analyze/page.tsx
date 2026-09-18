"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { UploadDropzone } from "@/components/upload-dropzone";
import { ImagePreview } from "@/components/image-preview";
import { AnalysisLoader } from "@/components/analysis-loader";
import { AnalysisResultView } from "@/components/analysis-result";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { PasteScreenshotButton, useClipboardPaste } from "@/components/screenshot-paste";
import type { AnalysisResult, AppState, ImageSource } from "@/lib/types";
import { fileToDataUrl } from "@/lib/utils";
import { saveHistoryEntry } from "@/lib/history";
import { DEMO_IMAGE_SRC, DEMO_FILE_NAME, DEMO_RESULT } from "@/lib/demo";
import { RotateCcw, Sparkles } from "lucide-react";

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

      const data = await response.json();

      if (!response.ok && !data?.result) {
        setState({
          status: "error",
          file,
          previewUrl,
          message: data?.error ?? "Something went wrong while analyzing your design. Please try again.",
        });
        return;
      }

      const result = data.result as AnalysisResult;

      if (!result.hasReadableText) {
        toast.warning("We couldn't confidently detect readable text in this design.");
      }

      setState({ status: "result", previewUrl, result, fileName: file.name });

      const thumbnailDataUrl = await fileToDataUrl(file).catch(() => previewUrl);
      saveHistoryEntry({ fileName: file.name, thumbnailDataUrl, result });
    } catch (err) {
      setState({
        status: "error",
        file,
        previewUrl,
        message: "Connection problem. Please check your internet connection and try again.",
      });
    }
  }, []);

  const handleFileSelected = useCallback(
    (file: File, source: ImageSource = "upload") => {
      const previewUrl = URL.createObjectURL(file);
      setState({ status: "preview", file, previewUrl, source });
    },
    []
  );

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

  const handleRetrySameImage = useCallback(() => {
    if (state.status !== "error" || !state.file || !state.previewUrl) {
      handleReset();
      return;
    }
    runAnalysis(state.file, state.previewUrl);
  }, [state, runAnalysis, handleReset]);

  const handleTryExample = useCallback(async () => {
    setState({ status: "analyzing", previewUrl: DEMO_IMAGE_SRC, stage: 0 });
    await new Promise((resolve) => setTimeout(resolve, 2200));
    setState({ status: "result", previewUrl: DEMO_IMAGE_SRC, result: DEMO_RESULT, fileName: DEMO_FILE_NAME });
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
    <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl text-ink sm:text-4xl">Analyze a design</h1>
          <p className="mt-2 max-w-lg text-ink-soft">
            Upload the image exactly as it will be posted. AI reads the visible text and reports back.
          </p>
        </div>
        {state.status !== "idle" && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Start over
          </Button>
        )}
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
          <div className="flex items-center justify-center gap-2 text-sm text-ink-soft">
            <span>Don't have a design handy?</span>
            <button
              type="button"
              onClick={handleTryExample}
              className="inline-flex items-center gap-1 font-medium text-pen underline-offset-4 hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Try an example
            </button>
          </div>
        </div>
      )}

      {state.status === "preview" && (
        <div className="flex flex-col items-center gap-6">
          {state.source === "paste" && (
            <p className="text-sm font-medium text-approve">Screenshot pasted ✓</p>
          )}
          <div className="w-full max-w-sm">
            <ImagePreview src={state.previewUrl} />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleReset}>
              Choose a different image
            </Button>
            <Button onClick={handleAnalyzeClick}>Analyze design</Button>
          </div>
        </div>
      )}

      {state.status === "analyzing" && <AnalysisLoader />}

      {state.status === "result" && (
        <div>
          <p className="mb-6 rounded-card border border-line bg-paper-dim/50 px-4 py-2.5 text-sm text-ink-soft">
            {state.fileName === DEMO_FILE_NAME ? "Showing example results." : `Results for ${state.fileName}`}
          </p>
          <AnalysisResultView previewUrl={state.previewUrl} result={state.result} />
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
            onRetry={state.file ? handleRetrySameImage : undefined}
            onChooseAnother={handleReset}
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
