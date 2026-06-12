"""Pydantic 資料模型。

LLM*-開頭的模型直接作為 Ollama structured output 的 JSON schema,
刻意保持扁平、欄位少,7B 模型才能穩定輸出。
"""

from typing import Literal

from pydantic import BaseModel, Field

RiskType = Literal[
    "auto_renewal",  # 自動續約
    "high_penalty",  # 高額違約金
    "non_compete",  # 競業禁止
    "unfavorable_termination",  # 不利終止條件
    "vague_terms",  # 模糊期限或條款
    "unilateral_change",  # 單方變更權
    "other",
]

RISK_TYPE_LABELS: dict[str, str] = {
    "auto_renewal": "自動續約",
    "high_penalty": "高額違約金",
    "non_compete": "競業禁止",
    "unfavorable_termination": "不利終止條件",
    "vague_terms": "模糊期限或條款",
    "unilateral_change": "單方變更權",
    "other": "其他風險",
}

Severity = Literal["low", "medium", "high"]

SEVERITY_WEIGHTS: dict[str, int] = {"high": 25, "medium": 12, "low": 5}


class Party(BaseModel):
    name: str = Field(description="當事人名稱(公司或個人)")
    role: str = Field(description="角色,如 出租人、承租人、雇主、受僱人、甲方、乙方")


class KeyFields(BaseModel):
    """合約關鍵欄位(LLM structured output)。"""

    parties: list[Party] = Field(default_factory=list, description="合約雙方當事人")
    subject: str | None = Field(default=None, description="合約標的,如租賃物、工作內容")
    amount: str | None = Field(default=None, description="金額與給付方式,依原文描述")
    start_date: str | None = Field(default=None, description="合約起始日,依原文格式")
    end_date: str | None = Field(default=None, description="合約截止日,依原文格式")
    termination: str | None = Field(default=None, description="終止/解約條件摘要")


class LLMRiskItem(BaseModel):
    """單一風險條款(LLM structured output)。"""

    risk_type: RiskType
    severity: Severity
    title: str = Field(description="風險標題,15 字內")
    explanation: str = Field(description="為何有風險、對哪一方不利,60 字內")
    quote: str = Field(description="逐字引用合約原文中構成風險的句子,不得改寫")


class LLMTypedRiskItem(BaseModel):
    """檢查清單掃描的單項輸出:風險類型由清單決定,模型不需自報。"""

    severity: Severity
    title: str = Field(description="風險標題,15 字內")
    explanation: str = Field(description="為何有風險、對哪一方不利,60 字內")
    quote: str = Field(description="逐字引用合約原文中構成風險的句子,不得改寫")


class LLMRiskScan(BaseModel):
    # 必填(無 default):JSON schema 會帶 required,Ollama constrained decoding
    # 從文法層禁止模型輸出 {} 偷懶;真的無風險仍可輸出 {"risks": []}
    risks: list[LLMTypedRiskItem]


class RiskFinding(LLMRiskItem):
    """風險條款 + 來源回溯結果。"""

    chunk_id: int
    start: int | None = None  # 引文在全文中的字元起點(驗證成功時)
    end: int | None = None
    verified: bool = False  # quote 是否真的存在於原文(防幻覺)


class ChunkOut(BaseModel):
    id: int
    text: str
    start: int
    end: int
    clause_no: str | None = None


class AnalysisReport(BaseModel):
    source: str
    full_text: str = ""  # 合約全文,UI 依 risks 的 start/end 絕對偏移渲染高亮
    key_fields: KeyFields
    risks: list[RiskFinding]
    risk_score: int = Field(ge=0, le=100)
    summary: str
    chunks: list[ChunkOut]


def compute_risk_score(risks: list[RiskFinding]) -> int:
    """加權累計風險分數,僅計入引文驗證成功的項目,上限 100。"""
    total = sum(SEVERITY_WEIGHTS[r.severity] for r in risks if r.verified)
    return min(100, total)
