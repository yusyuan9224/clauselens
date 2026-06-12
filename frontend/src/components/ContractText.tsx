"use client";

import { useEffect, useRef, useMemo } from "react";
import type { Report, Severity } from "@/lib/types";

interface HighlightSpan {
  start: number;
  end: number;
  severity: Severity;
  riskIndex: number;
}

function buildSegments(
  fullText: string,
  highlights: HighlightSpan[],
): { text: string; highlight: HighlightSpan | null; segId: string }[] {
  if (!fullText) return [];
  // Sort and resolve overlaps: higher severity wins
  const severityRank: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
  const sorted = [...highlights]
    .filter((h) => h.start != null && h.end != null && h.start < h.end)
    .sort((a, b) => a.start - b.start);

  // Build a non-overlapping list, higher severity wins on overlap
  const merged: HighlightSpan[] = [];
  for (const span of sorted) {
    if (merged.length === 0) { merged.push(span); continue; }
    const last = merged[merged.length - 1];
    if (span.start >= last.end) {
      merged.push(span);
    } else {
      // Overlap: pick higher severity for the overlapping region
      const winner = severityRank[span.severity] > severityRank[last.severity] ? span : last;
      // Replace last with the winner extended to cover both
      merged[merged.length - 1] = {
        ...winner,
        start: Math.min(last.start, span.start),
        end: Math.max(last.end, span.end),
      };
    }
  }

  const segments: { text: string; highlight: HighlightSpan | null; segId: string }[] = [];
  let cursor = 0;
  for (const h of merged) {
    if (h.start > cursor) {
      segments.push({ text: fullText.slice(cursor, h.start), highlight: null, segId: `plain-${cursor}` });
    }
    segments.push({ text: fullText.slice(h.start, h.end), highlight: h, segId: `hl-${h.riskIndex}` });
    cursor = h.end;
  }
  if (cursor < fullText.length) {
    segments.push({ text: fullText.slice(cursor), highlight: null, segId: `plain-${cursor}` });
  }
  return segments;
}

interface Props {
  report: Report;
  activeRiskIndex: number | null;
  onMarkClick: (riskIndex: number) => void;
}

export function ContractText({ report, activeRiskIndex, onMarkClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markRefs = useRef<Map<number, HTMLElement>>(new Map());

  const highlights: HighlightSpan[] = useMemo(() =>
    report.risks
      .map((r, i) => ({ start: r.start, end: r.end, severity: r.severity, riskIndex: i }))
      .filter((h): h is HighlightSpan => h.start !== null && h.end !== null),
    [report.risks],
  );

  const segments = useMemo(
    () => buildSegments(report.full_text, highlights),
    [report.full_text, highlights],
  );

  // Scroll to active risk mark and flash it
  useEffect(() => {
    if (activeRiskIndex === null) return;
    const el = markRefs.current.get(activeRiskIndex);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("cl-flash");
    void el.offsetWidth; // force reflow
    el.classList.add("cl-flash");
  }, [activeRiskIndex]);

  const severityClass: Record<Severity, string> = {
    high: "cl-high",
    medium: "cl-medium",
    low: "cl-low",
  };

  return (
    <div
      ref={containerRef}
      className="text-sm leading-7 whitespace-pre-wrap font-[PingFang_TC,Microsoft_JhengHei,system-ui,sans-serif] text-foreground"
    >
      {segments.map((seg) => {
        if (!seg.highlight) {
          return <span key={seg.segId}>{seg.text}</span>;
        }
        const { riskIndex, severity } = seg.highlight;
        return (
          <mark
            key={seg.segId}
            id={`mark-${riskIndex}`}
            ref={(el) => {
              if (el) markRefs.current.set(riskIndex, el);
              else markRefs.current.delete(riskIndex);
            }}
            className={`${severityClass[severity]} ${activeRiskIndex === riskIndex ? "cl-flash" : ""}`}
            onClick={() => onMarkClick(riskIndex)}
            title={report.risks[riskIndex]?.title}
            aria-label={`風險：${report.risks[riskIndex]?.title}`}
          >
            {seg.text}
          </mark>
        );
      })}
    </div>
  );
}
