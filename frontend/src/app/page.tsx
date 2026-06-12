"use client";

import { useState, useCallback } from "react";
import type { AnalysisState, Report } from "@/lib/types";
import { HealthBadge } from "@/components/HealthBadge";
import { UploadPanel } from "@/components/UploadPanel";
import { AnalyzingView } from "@/components/AnalyzingView";
import { ReportView } from "@/components/ReportView";
import { Separator } from "@/components/ui/separator";

const INITIAL_STATE: AnalysisState = {
  view: "upload",
  jobId: null,
  progressMessages: [],
  report: null,
  error: null,
  fileName: null,
};

export default function Home() {
  const [state, setState] = useState<AnalysisState>(INITIAL_STATE);

  const handleJobStarted = useCallback((jobId: string, fileName: string) => {
    setState({
      view: "analyzing",
      jobId,
      progressMessages: [],
      report: null,
      error: null,
      fileName,
    });
  }, []);

  const handleProgress = useCallback((msg: string) => {
    setState((prev) => ({
      ...prev,
      progressMessages: [...prev.progressMessages, msg],
    }));
  }, []);

  const handleDone = useCallback((report: Report) => {
    setState((prev) => ({ ...prev, view: "report", report }));
  }, []);

  const handleError = useCallback((msg: string) => {
    setState((prev) => ({ ...prev, error: msg }));
  }, []);

  const handleRetry = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const isReport = state.view === "report" && state.report;

  return (
    <div className="flex flex-col min-h-screen bg-[#F7F8FA]">
      {/* Top nav */}
      <header className="bg-[--cl-navy] text-white shrink-0">
        <div className="max-w-screen-xl mx-auto px-5 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-white/10 border border-white/20">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
              >
                <rect x="2" y="2" width="5" height="12" rx="1" fill="white" opacity="0.9" />
                <rect x="9" y="2" width="5" height="7" rx="1" fill="white" opacity="0.6" />
                <rect x="9" y="11" width="5" height="3" rx="1" fill="white" opacity="0.4" />
              </svg>
            </div>
            <span className="text-base font-semibold tracking-tight">ClauseLens</span>
          </div>

          {/* Health */}
          <div className="flex items-center">
            <HealthBadge />
          </div>
        </div>
      </header>

      {/* Main */}
      {isReport ? (
        /* Report view takes full remaining height */
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ReportView
            report={state.report!}
            fileName={state.fileName ?? "合約"}
            onReset={handleRetry}
          />
        </main>
      ) : (
        /* Upload / analyzing centered layout */
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-xl">
            {state.view === "upload" && (
              <>
                {/* Hero */}
                <div className="text-center mb-10">
                  <h1 className="text-3xl font-bold text-[--cl-navy] tracking-tight mb-3">
                    ClauseLens
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                    100% 本地離線的合約風險審查 —
                    <br />
                    你的合約不離開你的電腦
                  </p>
                </div>

                <Separator className="mb-8 opacity-50" />

                <UploadPanel onJobStarted={handleJobStarted} />
              </>
            )}

            {state.view === "analyzing" && state.jobId && (
              <>
                <div className="text-center mb-8">
                  <h1 className="text-2xl font-bold text-[--cl-navy] tracking-tight mb-2">
                    ClauseLens
                  </h1>
                  {state.fileName && (
                    <p className="text-sm text-muted-foreground">{state.fileName}</p>
                  )}
                </div>

                <Separator className="mb-8 opacity-50" />

                <AnalyzingView
                  jobId={state.jobId}
                  messages={state.progressMessages}
                  error={state.error}
                  onProgress={handleProgress}
                  onDone={handleDone}
                  onError={handleError}
                  onRetry={handleRetry}
                />
              </>
            )}
          </div>
        </main>
      )}

      {/* Footer — only shown on non-report views */}
      {!isReport && (
        <footer className="shrink-0 border-t border-border bg-white py-3 px-5">
          <p className="text-xs text-center text-muted-foreground">
            ClauseLens · 本地離線運行 · 合約資料不上傳雲端
          </p>
        </footer>
      )}
    </div>
  );
}
