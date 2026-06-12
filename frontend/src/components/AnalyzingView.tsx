"use client";

import { useEffect, useRef } from "react";
import { createJobEventSource } from "@/lib/api";
import type { Report } from "@/lib/types";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  jobId: string;
  messages: string[];
  error: string | null;
  onProgress: (msg: string) => void;
  onDone: (report: Report) => void;
  onError: (msg: string) => void;
  onRetry: () => void;
}

export function AnalyzingView({
  jobId,
  messages,
  error,
  onProgress,
  onDone,
  onError,
  onRetry,
}: Props) {
  const esRef = useRef<EventSource | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (error) return;

    const es = createJobEventSource(jobId);
    esRef.current = es;

    es.addEventListener("progress", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { message: string };
        onProgress(data.message);
      } catch {}
    });

    es.addEventListener("done", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { status: string; report: Report };
        onDone(data.report);
      } catch {
        onError("解析報告失敗");
      }
      es.close();
    });

    es.addEventListener("error", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as { status: string; error: string };
        onError(data.error ?? "分析失敗");
      } catch {
        onError("連線中斷，請重試");
      }
      es.close();
    });

    es.onerror = () => {
      onError("SSE 連線失敗，請重試");
      es.close();
    };

    return () => { es.close(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {error ? (
          <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
            <span className="cl-spin inline-block w-4 h-4 border-2 border-blue-200 border-t-[--cl-navy] rounded-full" />
          </div>
        )}
        <div>
          <p className="font-semibold text-sm text-foreground">
            {error ? "分析失敗" : "正在分析合約..."}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {error ? "請檢查錯誤訊息後重試" : "100% 本地運算，資料不離開你的電腦"}
          </p>
        </div>
      </div>

      {/* Progress steps */}
      <ul
        ref={listRef}
        className="space-y-1.5 max-h-72 overflow-y-auto pr-1"
        aria-live="polite"
        aria-label="分析進度"
      >
        {messages.map((msg, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-sm px-3 py-2 rounded-lg bg-secondary/60 border border-border"
          >
            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <span className="text-foreground leading-snug">{msg}</span>
          </li>
        ))}
        {!error && (
          <li className="flex items-start gap-2.5 text-sm px-3 py-2 rounded-lg bg-blue-50/60 border border-blue-100">
            <span className="cl-spin mt-0.5 shrink-0 inline-block w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full" />
            <span className="text-blue-700 leading-snug">處理中...</span>
          </li>
        )}
      </ul>

      {/* Error message */}
      {error && (
        <div className="mt-4 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Retry button */}
      {error && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="w-full mt-4 gap-2 border-[--cl-navy] text-[--cl-navy] hover:bg-[--cl-navy]/5"
        >
          <RefreshCw className="w-4 h-4" />
          重新分析
        </Button>
      )}
    </div>
  );
}
