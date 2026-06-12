"""分析管線:解析後文件 → 切塊 → embedding 索引 → 關鍵欄位 + 風險掃描 → 引文驗證 → 評分。"""

import asyncio
import re
from collections.abc import Callable

from .chunking import Chunk, chunk_text
from .config import settings
from .ollama_client import OllamaClient
from .parsing import ParsedDoc
from .schemas import (
    RISK_TYPE_LABELS,
    AnalysisReport,
    ChunkOut,
    KeyFields,
    LLMRiskScan,
    RiskFinding,
    compute_risk_score,
)
from .vectorstore import VectorStore

KEY_FIELDS_SYSTEM = """\
你是台灣的合約審查助理。從使用者提供的合約文字抽取關鍵欄位,以 JSON 輸出。
規則:
- 只根據合約原文,絕對不要編造;原文沒有的欄位輸出 null
- 日期、金額照原文格式抄寫,不要換算
- parties 的 role 用合約中的稱謂(如 甲方、乙方、出租人、承租人)"""

RISK_SCAN_SYSTEM = """\
你是台灣的合約風險審查專家,站在「弱勢一方」(承租人、受僱人、接案方)的立場找出風險條款。

風險類型定義:
- auto_renewal 自動續約:期滿未主動通知即自動續約
- high_penalty 高額違約金:違約金超過常理(如超過一個月租金/報酬數倍)
- non_compete 競業禁止:限制離職後工作,特別是無補償、範圍過廣者
- unfavorable_termination 不利終止條件:一方可隨時終止而他方不可、終止通知期不對等
- vague_terms 模糊期限或條款:義務或期限未明確定義(如「視情況」「另行通知」)
- unilateral_change 單方變更權:一方可單方修改條款、調整費用
- other 其他明顯不公平條款

規則:
- 只回報文字中「實際存在」的風險,沒有風險就輸出空陣列,不要硬湊
- quote 必須逐字複製合約原文句子,一字不改,不要自己改寫或翻譯
- 同一條款只回報一次,選最主要的風險類型
- explanation 用繁體中文,說明對哪一方不利、為什麼"""


def _normalize_for_match(s: str) -> str:
    return re.sub(r"\s+", "", s)


def find_quote_span(text: str, quote: str) -> tuple[int, int] | None:
    """在全文中定位引文。先精確比對,再做忽略空白的模糊比對(LLM 常吞換行)。"""
    quote = quote.strip()
    if not quote:
        return None
    idx = text.find(quote)
    if idx >= 0:
        return idx, idx + len(quote)
    if len(quote) > 400:  # 過長引文不做 regex 模糊比對,避免效能災難
        return None
    pattern = r"\s*".join(re.escape(ch) for ch in _normalize_for_match(quote))
    m = re.search(pattern, text)
    if m:
        return m.start(), m.end()
    return None


def _dedupe_risks(risks: list[RiskFinding]) -> list[RiskFinding]:
    """同類型且引文位置重疊者只留一筆(LLM 在 overlap 區常重複回報)。"""
    kept: list[RiskFinding] = []
    for r in sorted(risks, key=lambda x: (x.start is None, x.start or 0)):
        duplicate = any(
            k.risk_type == r.risk_type
            and k.start is not None
            and r.start is not None
            and max(k.start, r.start) < min(k.end or 0, r.end or 0)
            for k in kept
        )
        if not duplicate:
            kept.append(r)
    return kept


def _build_summary(key_fields: KeyFields, risks: list[RiskFinding], score: int) -> str:
    by_sev = {"high": 0, "medium": 0, "low": 0}
    for r in risks:
        by_sev[r.severity] += 1
    parties = "、".join(f"{p.name}({p.role})" for p in key_fields.parties) or "未識別"
    types = "、".join(dict.fromkeys(RISK_TYPE_LABELS[r.risk_type] for r in risks)) or "無"
    return (
        f"當事人:{parties}。共發現 {len(risks)} 項風險條款"
        f"(高 {by_sev['high']}、中 {by_sev['medium']}、低 {by_sev['low']}),"
        f"類型:{types}。整體風險分數 {score}/100。"
    )


async def analyze_document(
    parsed: ParsedDoc,
    ollama: OllamaClient,
    store: VectorStore | None = None,
    doc_id: str = "cli",
    progress: Callable[[str], None] | None = None,
) -> AnalysisReport:
    def report(msg: str) -> None:
        if progress:
            progress(msg)

    chunks = chunk_text(parsed.text, settings.chunk_max_chars, settings.chunk_overlap)
    report(f"切塊完成:{len(chunks)} 個段落")

    if store is not None and chunks:
        vectors = await ollama.embed([c.text for c in chunks])
        store.index_chunks(doc_id, chunks, vectors)
        report("embedding 索引完成")

    key_fields_task = ollama.generate_structured(
        KEY_FIELDS_SYSTEM,
        f"合約全文(節錄前段):\n{parsed.text[:4000]}",
        KeyFields,
    )
    risk_task = _scan_risks(parsed.text, chunks, ollama, report)
    key_fields, risks = await asyncio.gather(key_fields_task, risk_task)
    report(f"欄位抽取與風險掃描完成:{len(risks)} 項風險")

    score = compute_risk_score(risks)
    return AnalysisReport(
        source=parsed.source,
        full_text=parsed.text,
        key_fields=key_fields,
        risks=risks,
        risk_score=score,
        summary=_build_summary(key_fields, risks, score),
        chunks=[
            ChunkOut(id=c.id, text=c.text, start=c.start, end=c.end, clause_no=c.clause_no)
            for c in chunks
        ],
    )


async def _scan_risks(
    full_text: str,
    chunks: list[Chunk],
    ollama: OllamaClient,
    report: Callable[[str], None],
) -> list[RiskFinding]:
    batch_size = settings.risk_batch_size
    batches = [chunks[i : i + batch_size] for i in range(0, len(chunks), batch_size)]
    findings: list[RiskFinding] = []

    for bi, batch in enumerate(batches):
        body = "\n\n".join(
            f"【段落 {c.id}{f'|{c.clause_no}' if c.clause_no else ''}】\n{c.text}" for c in batch
        )
        scan = await ollama.generate_structured(
            RISK_SCAN_SYSTEM, f"請審查以下合約段落:\n\n{body}", LLMRiskScan
        )
        for item in scan.risks:
            span = find_quote_span(full_text, item.quote)
            chunk_id = batch[0].id
            if span:  # 依引文位置歸屬到正確 chunk
                for c in batch:
                    if c.start <= span[0] < c.end:
                        chunk_id = c.id
                        break
            findings.append(
                RiskFinding(
                    **item.model_dump(),
                    chunk_id=chunk_id,
                    start=span[0] if span else None,
                    end=span[1] if span else None,
                    verified=span is not None,
                )
            )
        report(f"風險掃描進度 {bi + 1}/{len(batches)}")

    return _dedupe_risks(findings)
