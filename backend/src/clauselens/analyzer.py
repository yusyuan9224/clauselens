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
- 只根據合約原文,絕對不要編造;原文完全沒提到的欄位才輸出 null
- 日期照原文抄寫,含民國紀年(如「民國一一五年七月一日」);起訖日通常在「租賃期間」「契約期間」「僱傭期間」等條款內,務必找出來
- amount 要涵蓋主要金額與押金/保證金(如「租金每月新台幣貳萬伍仟元,押金拾萬元」)
- parties 的 role 用合約中的稱謂(如 甲方、乙方、出租人、承租人、雇主、受僱人)
- termination 摘要「什麼條件下誰可以終止契約」,不要把整條期間條款照抄

範例輸出:
{"parties":[{"name":"王大明","role":"出租人(甲方)"},{"name":"林小華","role":"承租人(乙方)"}],
"subject":"台北市大安區某路某號房屋租賃",
"amount":"租金每月新台幣貳萬伍仟元整;押金新台幣拾萬元整",
"start_date":"民國一一五年七月一日","end_date":"民國一一六年六月三十日",
"termination":"乙方需於期滿三個月前書面通知,否則自動續約;甲方認使用不當得隨時終止"}"""

# 檢查清單式掃描:每種風險類型一次聚焦詢問。
# 「在整份合約找出所有風險」對 7B 模型太難(跨 run 變異大、漏報嚴重);
# 「這份合約有沒有 X?」是簡單得多的任務,實測穩定性顯著較好。
RISK_CHECKLIST: dict[str, str] = {
    "auto_renewal": "自動續約:租期/契約期滿時,若一方未在期限前主動通知,契約即自動續約或延長;"
    "特別注意通知期限過長(如需提前三個月)、續約條件可被另一方調整者",
    "high_penalty": "高額違約金或金錢損失:違約金超過常理(超過一個月租金/報酬、按日高比例罰金如每日5%、"
    "懲罰性違約金)、押金或保證金「沒收」「不予返還」「返還已受領之全部報酬」等條款",
    "non_compete": "競業禁止:限制離職後或合作結束後從事相同/類似工作,特別是無補償金、"
    "範圍過廣(地區、年限)、違反需付高額賠償者",
    "unfavorable_termination": "不利終止條件:一方可「隨時終止」契約而他方不可、終止通知期顯著不對等"
    "(如一方三日他方三十日)、終止後需限期遷出/交還且無補償、一方終止權需他方同意",
    "vague_terms": "模糊條款:義務、期限或標準未明確定義,如「視情況」「另行通知」「由甲方認定」"
    "「視營運狀況決定」「全權認定」等空白授權,讓一方有過大解釋空間",
    "unilateral_change": "單方變更權:一方可單方面修改契約內容、調整費用/需求/工作規則,"
    "且修改後即生效、他方須配合或不得異議",
}

RISK_CHECK_SYSTEM_TEMPLATE = """\
你是台灣的合約風險審查專家,站在弱勢一方(承租人、受僱人、接案方)的立場審查。

你「只」檢查一種風險型態:
【{label}】{definition}

規則:
- 找出合約中「所有」符合此型態的條款;若完全沒有,輸出 {{"risks": []}}
- 不屬於此型態的其他風險「不要」回報
- quote 必須逐字複製合約原文句子,一字不改,不要改寫、翻譯或省略
- explanation 用繁體中文說明對哪一方不利、為什麼
- severity 校準:high=重大金錢損失或重大權利剝奪;medium=不對等但損失有限;low=輕微不便"""


def _normalize_for_match(s: str) -> str:
    return re.sub(r"\s+", "", s)


# 全形/半形等價字元組:LLM 引用時常把半形逗號寫成全形(或反之),不應因此判定引文無效
_EQUIV_GROUPS = [",,", "。.", "::", ";;", "!!", "??", "((", "))", "「\"“", "」\"”", "—-", "、,"]
_EQUIV: dict[str, str] = {}
for _group in _EQUIV_GROUPS:
    for _ch in _group:
        _EQUIV[_ch] = _EQUIV.get(_ch, "") + _group


def _char_pattern(ch: str) -> str:
    if ch in _EQUIV:
        return f"[{re.escape(_EQUIV[ch])}]"
    return re.escape(ch)


def find_quote_span(text: str, quote: str) -> tuple[int, int] | None:
    """在全文中定位引文。先精確比對,再做容忍空白與全半形標點差異的模糊比對。"""
    quote = quote.strip()
    if not quote:
        return None
    idx = text.find(quote)
    if idx >= 0:
        return idx, idx + len(quote)
    if len(quote) > 400:  # 過長引文不做 regex 模糊比對,避免效能災難
        return None
    pattern = r"\s*".join(_char_pattern(ch) for ch in _normalize_for_match(quote))
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


def _windows(chunks: list[Chunk], max_chars: int) -> list[list[Chunk]]:
    """把 chunks 聚成 ≤max_chars 的視窗;短合約一個視窗,長合約逐窗檢查。"""
    windows: list[list[Chunk]] = []
    current: list[Chunk] = []
    size = 0
    for c in chunks:
        if current and size + len(c.text) > max_chars:
            windows.append(current)
            current, size = [], 0
        current.append(c)
        size += len(c.text)
    if current:
        windows.append(current)
    return windows


async def _scan_risks(
    full_text: str,
    chunks: list[Chunk],
    ollama: OllamaClient,
    report: Callable[[str], None],
) -> list[RiskFinding]:
    windows = _windows(chunks, settings.scan_window_chars)
    sem = asyncio.Semaphore(settings.scan_concurrency)
    done = 0
    total = len(RISK_CHECKLIST) * len(windows)

    async def check(risk_type: str, definition: str, window: list[Chunk]) -> list[RiskFinding]:
        nonlocal done
        system = RISK_CHECK_SYSTEM_TEMPLATE.format(
            label=RISK_TYPE_LABELS[risk_type], definition=definition
        )
        body = "\n".join(c.text for c in window)
        async with sem:
            scan = await ollama.generate_structured(system, f"合約內容:\n\n{body}", LLMRiskScan)
        done += 1
        report(f"風險檢查 {done}/{total}({RISK_TYPE_LABELS[risk_type]})")
        results: list[RiskFinding] = []
        for item in scan.risks:
            span = find_quote_span(full_text, item.quote)
            chunk_id = window[0].id
            if span:  # 依引文位置歸屬到正確 chunk
                for c in window:
                    if c.start <= span[0] < c.end:
                        chunk_id = c.id
                        break
            data = item.model_dump()
            data["risk_type"] = risk_type  # 以檢查清單的類型為準,不信模型自報
            results.append(
                RiskFinding(
                    **data,
                    chunk_id=chunk_id,
                    start=span[0] if span else None,
                    end=span[1] if span else None,
                    verified=span is not None,
                )
            )
        return results

    tasks = [
        check(risk_type, definition, window)
        for risk_type, definition in RISK_CHECKLIST.items()
        for window in windows
    ]
    findings = [f for batch in await asyncio.gather(*tasks) for f in batch]
    return _dedupe_risks(findings)
