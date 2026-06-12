"use client";

import { useRef, useState, useCallback } from "react";
import type { Report, Severity, RiskType } from "@/lib/types";
import { RISK_TYPE_LABELS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ContractText } from "@/components/ContractText";

interface Props {
  report: Report;
  fileName: string;
  onReset: () => void;
}

const SEVERITY_LABEL: Record<Severity, string> = {
  high: "高風險",
  medium: "中風險",
  low: "低風險",
};

const SEVERITY_COLORS: Record<
  Severity,
  { tag: string; text: string; dot: string }
> = {
  high: {
    tag: "text-risk-high border-risk-high/40 bg-risk-high-bg",
    text: "text-risk-high",
    dot: "bg-risk-high",
  },
  medium: {
    tag: "text-risk-medium border-risk-medium/40 bg-risk-medium-bg",
    text: "text-risk-medium",
    dot: "bg-risk-medium",
  },
  low: {
    tag: "text-risk-low border-risk-low/40 bg-risk-low-bg",
    text: "text-risk-low",
    dot: "bg-risk-low",
  },
};

function scoreColor(score: number): string {
  if (score >= 60) return "text-risk-high";
  if (score >= 30) return "text-risk-medium";
  return "text-risk-safe";
}

function scoreLabel(score: number): string {
  if (score >= 60) return "高風險";
  if (score >= 30) return "中風險";
  return "低風險";
}

function scoreTagClass(score: number): string {
  if (score >= 60) return SEVERITY_COLORS.high.tag;
  if (score >= 30) return SEVERITY_COLORS.medium.tag;
  return "text-risk-safe border-risk-safe/40 bg-risk-safe-bg";
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
      {children}
    </p>
  );
}

function KeyField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 py-2">
      <p className="font-mono text-[11px] text-muted-foreground leading-6">{label}</p>
      <p className="text-sm text-foreground leading-6 tabular-nums">
        {value ?? <span className="text-muted-foreground/70">未識別</span>}
      </p>
    </div>
  );
}

export function ReportView({ report, fileName, onReset }: Props) {
  const [activeRiskIndex, setActiveRiskIndex] = useState<number | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  const handleMarkClick = useCallback((riskIndex: number) => {
    setActiveRiskIndex(riskIndex);
    const el = cardRefs.current.get(riskIndex);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("cl-card-flash");
    void el.offsetWidth;
    el.classList.add("cl-card-flash");
  }, []);

  const handleCardClick = useCallback((riskIndex: number) => {
    setActiveRiskIndex(riskIndex);
  }, []);

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clauselens-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const highCount = report.risks.filter((r) => r.severity === "high").length;
  const mediumCount = report.risks.filter((r) => r.severity === "medium").length;
  const lowCount = report.risks.filter((r) => r.severity === "low").length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-6 py-2.5 border-b border-border bg-background shrink-0">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground shrink-0">
            審查報告
          </span>
          <span className="font-serif text-sm font-semibold text-foreground truncate">
            {fileName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="text-xs h-7 rounded-sm tracking-wide"
          >
            重新分析
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="text-xs h-7 rounded-sm tracking-wide"
          >
            下載 JSON
          </Button>
        </div>
      </div>

      {/* Dual pane */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT: risk overview + cards */}
        <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 overflow-y-auto border-r border-border bg-background">
          <div className="p-5 space-y-6">
            {/* Risk score */}
            <section className="border border-border bg-card rounded-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <Eyebrow>風險評分</Eyebrow>
                <span
                  className={`font-mono text-[10px] font-medium uppercase tracking-[0.15em] px-1.5 py-0.5 border rounded-sm ${scoreTagClass(report.risk_score)}`}
                >
                  {scoreLabel(report.risk_score)}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mb-3">
                <span
                  className={`font-serif text-6xl font-semibold leading-none tabular-nums ${scoreColor(report.risk_score)}`}
                >
                  {report.risk_score}
                </span>
                <span className="font-mono text-xs text-muted-foreground tabular-nums">/ 100</span>
              </div>
              {/* Mini counts */}
              <div className="flex gap-4 pb-3 mb-3 border-b border-border font-mono text-[11px] tabular-nums">
                {highCount > 0 && (
                  <span className="flex items-center gap-1.5 text-risk-high">
                    <span className="w-1.5 h-1.5 rounded-full bg-risk-high inline-block" />
                    高 {highCount}
                  </span>
                )}
                {mediumCount > 0 && (
                  <span className="flex items-center gap-1.5 text-risk-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-risk-medium inline-block" />
                    中 {mediumCount}
                  </span>
                )}
                {lowCount > 0 && (
                  <span className="flex items-center gap-1.5 text-risk-low">
                    <span className="w-1.5 h-1.5 rounded-full bg-risk-low inline-block" />
                    低 {lowCount}
                  </span>
                )}
                {report.risks.length === 0 && (
                  <span className="text-muted-foreground">未發現風險條款</span>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
            </section>

            {/* Key fields */}
            <section className="border border-border bg-card rounded-sm p-5">
              <div className="pb-2.5 mb-1 border-b border-border">
                <Eyebrow>關鍵欄位</Eyebrow>
              </div>
              <div className="divide-y divide-border">
                {/* Parties */}
                <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 py-2">
                  <p className="font-mono text-[11px] text-muted-foreground leading-6">當事人</p>
                  {report.key_fields.parties.length > 0 ? (
                    <ul className="space-y-0.5">
                      {report.key_fields.parties.map((p, i) => (
                        <li key={i} className="text-sm text-foreground leading-6">
                          {p.name}
                          {p.role && (
                            <span className="font-mono text-[11px] text-muted-foreground ml-1.5">
                              （{p.role}）
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm text-muted-foreground/70 leading-6">未識別</span>
                  )}
                </div>
                <KeyField label="標的" value={report.key_fields.subject} />
                <KeyField label="金額" value={report.key_fields.amount} />
                <KeyField label="起始日" value={report.key_fields.start_date} />
                <KeyField label="終止日" value={report.key_fields.end_date} />
                <KeyField label="終止條件" value={report.key_fields.termination} />
              </div>
            </section>

            {/* Risk cards */}
            {report.risks.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-baseline justify-between pb-2 border-b border-border">
                  <Eyebrow>風險條款</Eyebrow>
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                    共 {report.risks.length} 項
                  </span>
                </div>
                {report.risks.map((risk, i) => {
                  const colors = SEVERITY_COLORS[risk.severity];
                  const isActive = activeRiskIndex === i;
                  return (
                    <div
                      key={i}
                      ref={(el) => {
                        if (el) cardRefs.current.set(i, el);
                        else cardRefs.current.delete(i);
                      }}
                      onClick={() => handleCardClick(i)}
                      className={[
                        "border rounded-sm bg-card p-4 cursor-pointer",
                        "transition-colors duration-150",
                        isActive
                          ? "border-foreground"
                          : "border-border hover:border-foreground/40",
                      ].join(" ")}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isActive}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCardClick(i); }}
                    >
                      {/* Header row: clause number + corner severity tag */}
                      <div className="flex items-baseline justify-between gap-2 mb-2.5">
                        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                          {String(i + 1).padStart(2, "0")} ·{" "}
                          {RISK_TYPE_LABELS[risk.risk_type as RiskType] ?? risk.risk_type}
                        </span>
                        <span
                          className={`font-mono text-[10px] font-medium uppercase tracking-[0.15em] px-1.5 py-0.5 border rounded-sm shrink-0 ${colors.tag}`}
                        >
                          {SEVERITY_LABEL[risk.severity]}
                        </span>
                      </div>

                      {/* Title */}
                      <p className="font-serif font-semibold text-[15px] text-foreground leading-snug mb-1.5">
                        {risk.title}
                      </p>

                      {/* Explanation */}
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {risk.explanation}
                      </p>

                      {/* Quote */}
                      {risk.quote && (
                        <blockquote className="border-l border-border pl-3 py-0.5 font-serif text-[13px] leading-relaxed text-foreground/75">
                          「{risk.quote}」
                        </blockquote>
                      )}

                      {/* Unverified warning */}
                      {!risk.verified && (
                        <p className="mt-2.5 font-mono text-[11px] text-risk-medium">
                          ※ 引文未對回原文
                        </p>
                      )}

                      {/* Highlight hint */}
                      {risk.start !== null && (
                        <p className="mt-2.5 font-mono text-[11px] text-muted-foreground/70">
                          點擊定位原文位置 →
                        </p>
                      )}
                    </div>
                  );
                })}
              </section>
            )}

            {report.risks.length === 0 && (
              <div className="text-center py-10 border border-border rounded-sm bg-card">
                <p className="font-serif text-sm text-muted-foreground">未發現明顯風險條款</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: contract full text */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-card">
          <div className="sticky top-0 z-10 px-7 py-2.5 border-b border-border bg-card/95 backdrop-blur-sm flex items-baseline gap-3">
            <Eyebrow>合約全文</Eyebrow>
            {report.risks.filter((r) => r.start !== null).length > 0 && (
              <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                已標記 {report.risks.filter((r) => r.start !== null).length} 處風險
              </span>
            )}
          </div>
          <div className="px-7 py-6 max-w-3xl">
            <ContractText
              report={report}
              activeRiskIndex={activeRiskIndex}
              onMarkClick={handleMarkClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
