"""FastAPI 服務:上傳合約 → 背景分析 → SSE 進度串流 → 報告。

單機自架定位,任務存在記憶體;重啟後任務消失是可接受的取捨。
"""

import asyncio
import json
import tempfile
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .analyzer import analyze_document
from .config import settings
from .ollama_client import OllamaClient
from .parsing import SUPPORTED_SUFFIXES, parse_file, parse_text
from .schemas import AnalysisReport
from .vectorstore import VectorStore

MAX_UPLOAD_BYTES = 20 * 1024 * 1024

JobStatus = Literal["queued", "running", "done", "error"]


@dataclass
class Job:
    id: str
    status: JobStatus = "queued"
    progress: list[str] = field(default_factory=list)
    report: AnalysisReport | None = None
    error: str | None = None
    event: asyncio.Event = field(default_factory=asyncio.Event)

    def push(self, message: str) -> None:
        self.progress.append(message)
        self.event.set()


jobs: dict[str, Job] = {}

app = FastAPI(title="ClauseLens API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TextIn(BaseModel):
    text: str


class JobOut(BaseModel):
    job_id: str


@app.get("/api/health")
async def health() -> dict:
    ollama = OllamaClient(timeout=5)
    try:
        resp = await ollama._client.get("/api/tags")
        resp.raise_for_status()
        models = [m["name"] for m in resp.json().get("models", [])]
        return {"status": "ok", "ollama": True, "models": models}
    except Exception:  # noqa: BLE001
        return {"status": "degraded", "ollama": False, "models": []}
    finally:
        await ollama.aclose()


@app.post("/api/analyze/file", response_model=JobOut)
async def analyze_file(file: UploadFile = File(...)) -> JobOut:
    suffix = Path(file.filename or "upload").suffix.lower()
    if suffix not in SUPPORTED_SUFFIXES:
        raise HTTPException(415, f"不支援的格式 {suffix},支援:{sorted(SUPPORTED_SUFFIXES)}")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "檔案超過 20MB 上限")

    def load():
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(data)
            tmp_path = Path(tmp.name)
        try:
            parsed = parse_file(tmp_path)
            parsed.source = file.filename or tmp_path.name
            return parsed
        finally:
            tmp_path.unlink(missing_ok=True)

    return _start_job(load)


@app.post("/api/analyze/text", response_model=JobOut)
async def analyze_text(payload: TextIn) -> JobOut:
    if not payload.text.strip():
        raise HTTPException(422, "合約文字不可為空")
    return _start_job(lambda: parse_text(payload.text))


def _start_job(load_parsed) -> JobOut:
    job = Job(id=uuid.uuid4().hex[:12])
    jobs[job.id] = job
    asyncio.get_running_loop().create_task(_run_job(job, load_parsed))
    return JobOut(job_id=job.id)


async def _run_job(job: Job, load_parsed) -> None:
    job.status = "running"
    job.push("開始分析")
    ollama = OllamaClient()
    try:
        parsed = await asyncio.to_thread(load_parsed)
        store = VectorStore(url=settings.qdrant_url)
        job.report = await analyze_document(
            parsed, ollama, store=store, doc_id=job.id, progress=job.push
        )
        job.status = "done"
        job.push("分析完成")
    except Exception as exc:  # noqa: BLE001
        job.status = "error"
        job.error = str(exc)
        job.push(f"分析失敗:{exc}")
    finally:
        await ollama.aclose()


def _get_job(job_id: str) -> Job:
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(404, "找不到該任務")
    return job


@app.get("/api/jobs/{job_id}")
async def job_status(job_id: str) -> dict:
    job = _get_job(job_id)
    return {
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
        "error": job.error,
        "report": job.report.model_dump() if job.report else None,
    }


@app.get("/api/jobs/{job_id}/events")
async def job_events(job_id: str) -> StreamingResponse:
    """SSE:每有新進度推一筆 progress 事件,結束時推 done/error。"""
    job = _get_job(job_id)

    async def stream():
        sent = 0
        while True:
            while sent < len(job.progress):
                yield f"event: progress\ndata: {json.dumps({'message': job.progress[sent]}, ensure_ascii=False)}\n\n"
                sent += 1
            if job.status in ("done", "error"):
                payload = {
                    "status": job.status,
                    "error": job.error,
                    "report": job.report.model_dump() if job.report else None,
                }
                yield f"event: {job.status}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"
                return
            job.event.clear()
            try:
                await asyncio.wait_for(job.event.wait(), timeout=15)
            except TimeoutError:
                yield ": keepalive\n\n"

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
