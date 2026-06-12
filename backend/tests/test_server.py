import asyncio

import pytest
from fastapi.testclient import TestClient

import clauselens.server as server_mod
from clauselens.schemas import AnalysisReport, KeyFields


@pytest.fixture
def client(monkeypatch):
    async def fake_analyze(parsed, ollama, store=None, doc_id="x", progress=None):
        if progress:
            progress("切塊完成:1 個段落")
        await asyncio.sleep(0)
        return AnalysisReport(
            source=parsed.source,
            key_fields=KeyFields(),
            risks=[],
            risk_score=0,
            summary="ok",
            chunks=[],
        )

    monkeypatch.setattr(server_mod, "analyze_document", fake_analyze)
    monkeypatch.setattr(server_mod, "VectorStore", lambda url=None: None)
    server_mod.jobs.clear()
    return TestClient(server_mod.app)


def test_analyze_text_full_flow(client):
    resp = client.post("/api/analyze/text", json={"text": "第一條 測試條款。"})
    assert resp.status_code == 200
    job_id = resp.json()["job_id"]

    for _ in range(50):
        status = client.get(f"/api/jobs/{job_id}").json()
        if status["status"] == "done":
            break
    assert status["status"] == "done"
    assert status["report"]["summary"] == "ok"
    assert any("切塊完成" in p for p in status["progress"])


def test_analyze_text_rejects_empty(client):
    assert client.post("/api/analyze/text", json={"text": "   "}).status_code == 422


def test_analyze_file_rejects_unknown_suffix(client):
    resp = client.post(
        "/api/analyze/file", files={"file": ("contract.exe", b"x", "application/octet-stream")}
    )
    assert resp.status_code == 415


def test_unknown_job_404(client):
    assert client.get("/api/jobs/nope").status_code == 404
