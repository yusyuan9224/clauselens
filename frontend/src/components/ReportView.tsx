"use client";

import { useRef, useState, useCallback } from "react";
import type { Report, Severity, RiskType } from "@/lib/types";
import { RISK_TYPE_LABELS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContractText } from "@/components/ContractText";
import {
  AlertTriangle,
  RefreshCw,
  Download,
  FileText,
  Users,
  Calendar,
  DollarSign,
  XCircle,
  ShieldAlert,
} from "lucide-react";

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
  { badge: string; border: string; bg: string; text: string; dot: string }
> = {
  high: {
    badge: "bg-red-100 text-red-700 border border-red-200",
    border: "border-l-red-500",
    bg: "bg-[--cl-red-bg]",
    text: "text-red-700",
    dot: "bg-red-500",
  },
  medium: {
    badge: "bg-orange-100 text-orange-700 border border-orange-200",
    border: "border-l-orange-500",
    bg: "bg-[--cl-orange-bg]",
    text: "text-orange-700",
    dot: "bg-orange-500",
  },
  low: {
    badge: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    border: "border-l-yellow-500",
    bg: "bg-[--cl-yellow-bg]",
    text: "text-yellow-700",
    dot: "bg-yellow-400",
  },
};

function scoreColor(score: number): string {
  if (score >= 60) return "text-red-600";
  if (score >= 30) return "text-orange-500";
  return "text-green-600";
}

function scoreLabel(score: number): string {
  if (score >= 60) return "高風險";
  if (score >= 30) return "中風險";
  return "低風險";
}

function scoreBg(score: number): string {
  if (score >= 60) return "bg-red-50 border-red-200";
  if (score >= 30) return "bg-orange-50 border-orange-200";
  return "bg-green-50 border-green-200";
}

function KeyField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="text-muted-foreground mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground leading-none mb-1">{label}</p>
        <p className="text-sm text-foreground leading-snug">
          {value ?? <span className="text-muted-foreground italic">未識別</span>}
        </p>
      </div>
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
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-white shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">{fileName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="gap-1.5 text-xs h-8 border-border"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            重新分析
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-1.5 text-xs h-8 border-border"
          >
            <Download className="w-3.5 h-3.5" />
            下載 JSON
          </Button>
        </div>
      </div>

      {/* Dual pane */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT: risk overview + cards */}
        <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 overflow-y-auto border-r border-border bg-white">
          <div className="p-5 space-y-5">
            {/* Risk score */}
            <div className={`rounded-xl border p-5 ${scoreBg(report.risk_score)}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    風險評分
                  </span>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${scoreBg(report.risk_score)} ${scoreColor(report.risk_score)}`}
                >
                  {scoreLabel(report.risk_score)}
                </span>
              </div>
              <div className="flex items-end gap-3 mb-3">
                <span className={`text-6xl font-bold leading-none tabular-nums ${scoreColor(report.risk_score)}`}>
                  {report.risk_score}
                </span>
                <span className="text-muted-foreground text-sm mb-1">/ 100</span>
              </div>
              {/* Mini counts */}
              <div className="flex gap-3 mb-4">
                {highCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-red-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                    {highCount} 高
                  </span>
                )}
                {mediumCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-orange-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                    {mediumCount} 中
                  </span>
                )}
                {lowCount > 0 && (
                  <span className="flex items-center gap-1 text-xs text-yellow-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />
                    {lowCount} 低
                  </span>
                )}
                {report.risks.length === 0 && (
                  <span className="text-xs text-muted-foreground">未發現風險條款</span>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed">{report.summary}</p>
            </div>

            {/* Key fields */}
            <Card className="shadow-none">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  關鍵欄位
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0 space-y-0 divide-y divide-border">
                {/* Parties */}
                <div className="flex items-start gap-2.5 py-2">
                  <div className="text-muted-foreground mt-0.5 shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground leading-none mb-1">當事人</p>
                    {report.key_fields.parties.length > 0 ? (
                      <ul className="space-y-0.5">
                        {report.key_fields.parties.map((p, i) => (
                          <li key={i} className="text-sm text-foreground leading-snug">
                            {p.name}
                            {p.role && (
                              <span className="text-muted-foreground text-xs ml-1.5">({p.role})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">未識別</span>
                    )}
                  </div>
                </div>
                <KeyField
                  icon={<FileText className="w-4 h-4" />}
                  label="標的"
                  value={report.key_fields.subject}
                />
                <KeyField
                  icon={<DollarSign className="w-4 h-4" />}
                  label="金額"
                  value={report.key_fields.amount}
                />
                <KeyField
                  icon={<Calendar className="w-4 h-4" />}
                  label="起始日"
                  value={report.key_fields.start_date}
                />
                <KeyField
                  icon={<Calendar className="w-4 h-4" />}
                  label="終止日"
                  value={report.key_fields.end_date}
                />
                <KeyField
                  icon={<XCircle className="w-4 h-4" />}
                  label="終止條件"
                  value={report.key_fields.termination}
                />
              </CardContent>
            </Card>

            {/* Risk cards */}
            {report.risks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  風險條款（{report.risks.length}）
                </h2>
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
                        "rounded-xl border-l-4 border border-border p-4 cursor-pointer",
                        "transition-all duration-150",
                        colors.border,
                        isActive ? "ring-2 ring-offset-1 ring-[--cl-navy]/30 shadow-sm" : "hover:shadow-sm hover:border-l-4",
                      ].join(" ")}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isActive}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleCardClick(i); }}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${colors.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            {SEVERITY_LABEL[risk.severity]}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-xs px-2 py-0.5 font-normal text-muted-foreground border-border"
                          >
                            {RISK_TYPE_LABELS[risk.risk_type as RiskType] ?? risk.risk_type}
                          </Badge>
                        </div>
                      </div>

                      {/* Title */}
                      <p className="font-semibold text-sm text-foreground leading-snug mb-1.5">
                        {risk.title}
                      </p>

                      {/* Explanation */}
                      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                        {risk.explanation}
                      </p>

                      {/* Quote */}
                      {risk.quote && (
                        <blockquote className={`border-l-2 ${colors.border.replace("border-l-", "border-l-")} pl-3 py-1 rounded-r text-xs leading-relaxed text-foreground/80 bg-secondary/40`}>
                          「{risk.quote}」
                        </blockquote>
                      )}

                      {/* Unverified warning */}
                      {!risk.verified && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          ⚠ 引文未對回原文
                        </div>
                      )}

                      {/* Highlight hint */}
                      {risk.start !== null && (
                        <p className="mt-2.5 text-xs text-muted-foreground">
                          點擊可在右欄定位原文位置
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {report.risks.length === 0 && (
              <div className="text-center py-10 text-muted-foreground text-sm">
                未發現明顯風險條款
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: contract full text */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-white">
          <div className="sticky top-0 z-10 px-5 py-2.5 border-b border-border bg-white/95 backdrop-blur-sm">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" />
              合約全文
              {report.risks.filter((r) => r.start !== null).length > 0 && (
                <span className="text-muted-foreground/60">
                  · 已標記 {report.risks.filter((r) => r.start !== null).length} 處風險
                </span>
              )}
            </p>
          </div>
          <div className="px-6 py-5">
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
