"""中文合約切塊。

中文沒有空格可依賴,通用 splitter 容易把條款切碎。策略:
1. 優先以「第 N 條」條款標題切段 —— 條款是合約的語義單位
2. 超長條款再以中文句讀(。;!?)細切,帶 overlap
3. 無條款標號的文件直接走句讀累積切塊
所有 chunk 都保留對全文的絕對字元偏移,供 citation 高亮回跳。
"""

import re
from dataclasses import dataclass

CLAUSE_RE = re.compile(r"第\s*[0-9一二三四五六七八九十百零〇]+\s*條")
SENTENCE_END_RE = re.compile(r"[。;!?\n]")


@dataclass
class Chunk:
    id: int
    text: str
    start: int  # 對全文的字元偏移
    end: int
    clause_no: str | None = None


def chunk_text(text: str, max_chars: int = 600, overlap: int = 80) -> list[Chunk]:
    segments = _split_by_clause(text)
    chunks: list[Chunk] = []
    for seg_start, seg_end, clause_no in segments:
        seg_text = text[seg_start:seg_end]
        if len(seg_text) <= max_chars:
            if seg_text.strip():
                chunks.append(
                    Chunk(id=len(chunks), text=seg_text, start=seg_start, end=seg_end, clause_no=clause_no)
                )
            continue
        for sub_start, sub_end in _split_by_sentence(seg_text, max_chars, overlap):
            sub = seg_text[sub_start:sub_end]
            if sub.strip():
                chunks.append(
                    Chunk(
                        id=len(chunks),
                        text=sub,
                        start=seg_start + sub_start,
                        end=seg_start + sub_end,
                        clause_no=clause_no,
                    )
                )
    return chunks


def _split_by_clause(text: str) -> list[tuple[int, int, str | None]]:
    """以條款標題切段,回傳 (start, end, 條號) 列表;無標號時回傳整篇。"""
    matches = list(CLAUSE_RE.finditer(text))
    if not matches:
        return [(0, len(text), None)]
    segments: list[tuple[int, int, str | None]] = []
    if matches[0].start() > 0:
        segments.append((0, matches[0].start(), None))  # 前言(當事人、立約聲明)
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        segments.append((m.start(), end, re.sub(r"\s+", "", m.group())))
    return segments


def _split_by_sentence(text: str, max_chars: int, overlap: int) -> list[tuple[int, int]]:
    """句讀累積切塊,相鄰塊帶 overlap;回傳相對於 text 的 (start, end)。"""
    boundaries = [m.end() for m in SENTENCE_END_RE.finditer(text)]
    if not boundaries or boundaries[-1] < len(text):
        boundaries.append(len(text))

    spans: list[tuple[int, int]] = []
    start = 0
    prev_boundary = 0
    for b in boundaries:
        if b - start >= max_chars:
            # 在 max_chars 內至少包含一個完整句子;單句超長則硬切
            end = prev_boundary if prev_boundary > start else min(start + max_chars, b)
            spans.append((start, end))
            start = max(end - overlap, start + 1)
        prev_boundary = b
    if start < len(text):
        spans.append((start, len(text)))
    return spans
