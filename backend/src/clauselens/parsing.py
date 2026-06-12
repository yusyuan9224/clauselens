"""文件解析:PDF / Word / 純文字 → 全文字串 + 頁碼偏移對照。

保留原始字元偏移,citation 回跳與高亮都依賴 start/end 對全文的精確對應,
因此解析後不做會改變長度的正規化。
"""

from dataclasses import dataclass, field
from pathlib import Path

import fitz  # PyMuPDF
from docx import Document


@dataclass
class PageSpan:
    page_no: int  # 1-based
    start: int
    end: int


@dataclass
class ParsedDoc:
    text: str
    source: str
    pages: list[PageSpan] = field(default_factory=list)

    def page_of(self, offset: int) -> int | None:
        for p in self.pages:
            if p.start <= offset < p.end:
                return p.page_no
        return None


SUPPORTED_SUFFIXES = {".pdf", ".docx", ".txt", ".md"}


def parse_file(path: str | Path) -> ParsedDoc:
    path = Path(path)
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return parse_pdf(path)
    if suffix == ".docx":
        return parse_docx(path)
    if suffix in {".txt", ".md"}:
        return parse_text(path.read_text(encoding="utf-8"), source=path.name)
    raise ValueError(f"不支援的檔案格式:{suffix}(支援 {sorted(SUPPORTED_SUFFIXES)})")


def parse_pdf(path: Path) -> ParsedDoc:
    pages: list[PageSpan] = []
    parts: list[str] = []
    offset = 0
    with fitz.open(path) as doc:
        for i, page in enumerate(doc, start=1):
            text = page.get_text("text")
            parts.append(text)
            pages.append(PageSpan(page_no=i, start=offset, end=offset + len(text)))
            offset += len(text)
    return ParsedDoc(text="".join(parts), source=path.name, pages=pages)


def parse_docx(path: Path) -> ParsedDoc:
    doc = Document(str(path))
    text = "\n".join(p.text for p in doc.paragraphs)
    return ParsedDoc(text=text, source=path.name)


def parse_text(text: str, source: str = "text-input") -> ParsedDoc:
    return ParsedDoc(text=text, source=source)
