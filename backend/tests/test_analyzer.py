from clauselens.analyzer import _dedupe_risks, find_quote_span
from clauselens.schemas import RiskFinding, compute_risk_score


def make_finding(**kw) -> RiskFinding:
    base = dict(
        risk_type="high_penalty",
        severity="high",
        title="t",
        explanation="e",
        quote="q",
        chunk_id=0,
        start=None,
        end=None,
        verified=False,
    )
    base.update(kw)
    return RiskFinding(**base)


class TestFindQuoteSpan:
    def test_exact_match(self):
        text = "甲方得沒收全部押金,乙方不得異議。"
        span = find_quote_span(text, "沒收全部押金")
        assert span and text[span[0] : span[1]] == "沒收全部押金"

    def test_whitespace_tolerant_match(self):
        text = "乙方應賠償甲方\n相當於六個月租金之違約金。"
        span = find_quote_span(text, "乙方應賠償甲方相當於六個月租金之違約金")
        assert span is not None
        assert text[span[0] : span[1]].replace("\n", "") == "乙方應賠償甲方相當於六個月租金之違約金"

    def test_fullwidth_halfwidth_punctuation_tolerant(self):
        text = "乙方不得拒絕,並應配合辦理。"  # 原文半形逗號
        span = find_quote_span(text, "乙方不得拒絕,並應配合辦理。")  # LLM 引用寫成全形
        assert span is not None
        assert text[span[0] : span[1]] == text

    def test_hallucinated_quote_returns_none(self):
        assert find_quote_span("合約原文。", "這句根本不存在的引文") is None

    def test_empty_quote(self):
        assert find_quote_span("text", "  ") is None


class TestDedupe:
    def test_overlapping_same_type_removed(self):
        a = make_finding(start=10, end=50, verified=True)
        b = make_finding(start=30, end=60, verified=True)
        assert len(_dedupe_risks([a, b])) == 1

    def test_different_type_kept(self):
        a = make_finding(start=10, end=50)
        b = make_finding(start=30, end=60, risk_type="auto_renewal")
        assert len(_dedupe_risks([a, b])) == 2

    def test_unverified_kept(self):
        a = make_finding()
        b = make_finding(risk_type="vague_terms")
        assert len(_dedupe_risks([a, b])) == 2


class TestRiskScore:
    def test_only_verified_counted(self):
        risks = [make_finding(verified=True, severity="high"), make_finding(verified=False, severity="high")]
        assert compute_risk_score(risks) == 25

    def test_capped_at_100(self):
        risks = [make_finding(verified=True, severity="high") for _ in range(10)]
        assert compute_risk_score(risks) == 100

    def test_empty(self):
        assert compute_risk_score([]) == 0
