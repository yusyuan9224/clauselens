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
    <div className="flex flex-col min-h-screen bg-background">
      {/* Masthead */}
      <header className="shrink-0 bg-background border-b border-border">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-end justify-between pb-3">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="font-serif text-[1.4rem] font-semibold tracking-tight text-foreground leading-none">
              ClauseLens
            </span>
            <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              合約條款風險審查
            </span>
          </div>
          <HealthBadge />
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
                <div className="text-center mb-9">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
                    文件審查
                  </p>
                  <h1 className="font-serif text-3xl font-semibold text-foreground tracking-tight mb-3">
                    合約條款風險分析
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                    100% 本地離線審查 — 你的合約不離開你的電腦
                  </p>
                </div>

                <Separator className="mb-8" />

                <UploadPanel onJobStarted={handleJobStarted} />
              </>
            )}

            {state.view === "analyzing" && state.jobId && (
              <>
                <div className="text-center mb-8">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
                    分析進行中
                  </p>
                  <h1 className="font-serif text-2xl font-semibold text-foreground tracking-tight mb-2">
                    合約條款風險分析
                  </h1>
                  {state.fileName && (
                    <p className="font-mono text-xs text-muted-foreground">{state.fileName}</p>
                  )}
                </div>

                <Separator className="mb-8" />

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
        <footer className="shrink-0 border-t border-border bg-background py-3 px-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-center text-muted-foreground">
            ClauseLens · 本地離線運行 · 合約資料不上傳雲端
          </p>
        </footer>
      )}
    </div>
  );
}
