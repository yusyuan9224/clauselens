from clauselens.chunking import CLAUSE_RE, chunk_text


def test_clause_split_basic():
    text = "前言:甲乙雙方約定如下。\n第一條 標的\n內容A。\n第二條 租金\n內容B。"
    chunks = chunk_text(text)
    clause_nos = [c.clause_no for c in chunks]
    assert None in clause_nos  # 前言
    assert "第一條" in clause_nos
    assert "第二條" in clause_nos


def test_chunk_offsets_match_source():
    text = "前言。\n第一條 條款內容甲。\n第二條 條款內容乙,字數較多一些。"
    for c in chunk_text(text):
        assert text[c.start : c.end] == c.text


def test_long_clause_subsplit_with_overlap():
    sentences = "".join(f"這是第{i}句測試句子,用來填充長度。" for i in range(60))
    text = f"第一條 超長條款\n{sentences}"
    chunks = chunk_text(text, max_chars=300, overlap=50)
    assert len(chunks) > 1
    assert all(c.clause_no == "第一條" for c in chunks)
    assert all(len(c.text) <= 300 + 50 for c in chunks)
    for c in chunks:
        assert text[c.start : c.end] == c.text


def test_no_clause_marker_fallback():
    text = "這是一份沒有條款標號的合約。" * 80
    chunks = chunk_text(text, max_chars=400, overlap=40)
    assert len(chunks) > 1
    for c in chunks:
        assert text[c.start : c.end] == c.text


def test_chinese_numeral_clause_detection():
    assert CLAUSE_RE.search("第十二條 違約金")
    assert CLAUSE_RE.search("第 3 條 終止")
    assert not CLAUSE_RE.search("依第三人之請求")  # 「第三人」不是條款標題

def test_empty_text():
    assert chunk_text("") == []
