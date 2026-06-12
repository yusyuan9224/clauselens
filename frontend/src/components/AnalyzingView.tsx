"use client";

import { useEffect, useRef } from "react";
import { createJobEventSource } from "@/lib/api";
import type { Report } from "@/lib/types";
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
      <div className="mb-5 pb-3 border-b border-border flex items-baseline justify-between gap-3">
        <p className={`font-serif text-base font-semibold ${error ? "text-risk-high" : "text-foreground"}`}>
          {error ? "分析失敗" : "正在審查合約"}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {error ? "請檢查錯誤訊息後重試" : "100% 本地運算 · 資料不離開你的電腦"}
        </p>
      </div>

      {/* Progress steps */}
      <ul
        ref={listRef}
        className="max-h-72 overflow-y-auto pr-1 divide-y divide-border border-y border-border"
        aria-live="polite"
        aria-label="分析進度"
      >
        {messages.map((msg, i) => (
          <li
            key={i}
            className="flex items-baseline gap-3 text-sm px-1 py-2"
          >
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0 w-6">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-muted-foreground leading-snug">{msg}</span>
          </li>
        ))}
        {!error && (
          <li className="flex items-center gap-3 text-sm px-1 py-2">
            <span className="shrink-0 w-6 flex items-center">
              <span className="cl-spin inline-block w-3.5 h-3.5 border-2 border-primary/25 border-t-primary rounded-full" />
            </span>
            <span className="text-foreground leading-snug">處理中...</span>
          </li>
        )}
      </ul>

      {/* Error message */}
      {error && (
        <div className="mt-4 border border-risk-high bg-risk-high-bg rounded-sm px-3 py-3 text-sm text-risk-high">
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] mr-2">錯誤</span>
          {error}
        </div>
      )}

      {/* Retry button */}
      {error && (
        <Button
          onClick={onRetry}
          variant="outline"
          className="w-full mt-5 h-10 rounded-sm tracking-wide"
        >
          重新分析
        </Button>
      )}
    </div>
  );
}
