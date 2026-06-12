"""CLI:clauselens analyze 合約檔 → 終端機輸出關鍵欄位 + 風險條款。"""

import asyncio
from pathlib import Path

import typer

from .analyzer import analyze_document
from .config import settings
from .ollama_client import OllamaClient
from .parsing import parse_file
from .schemas import RISK_TYPE_LABELS, AnalysisReport
from .vectorstore import VectorStore

app = typer.Typer(help="ClauseLens — 本地繁中合約風險審查器", no_args_is_help=True)

SEVERITY_MARKS = {"high": "🔴 高", "medium": "🟠 中", "low": "🟡 低"}


@app.command()
def analyze(
    file: Path = typer.Argument(..., exists=True, readable=True, help="合約檔(.pdf/.docx/.txt/.md)"),
    json_out: Path | None = typer.Option(None, "--json", help="另存完整 JSON 報告"),
    no_embed: bool = typer.Option(False, "--no-embed", help="跳過 embedding 索引(較快)"),
) -> None:
    """分析合約:抽取關鍵欄位、標出風險條款。"""
    report = asyncio.run(_analyze(file, no_embed))
    _print_report(report)
    if json_out:
        json_out.write_text(report.model_dump_json(indent=2), encoding="utf-8")
        typer.echo(f"\n完整報告已存至 {json_out}")


async def _analyze(file: Path, no_embed: bool) -> AnalysisReport:
    ollama = OllamaClient()
    store = None if no_embed else VectorStore(url=settings.qdrant_url)
    try:
        parsed = parse_file(file)
        return await analyze_document(
            parsed, ollama, store=store, doc_id=file.stem, progress=lambda m: typer.echo(f"  · {m}")
        )
    finally:
        await ollama.aclose()


def _print_report(r: AnalysisReport) -> None:
    typer.echo("\n══════════ 關鍵欄位 ══════════")
    kf = r.key_fields
    for p in kf.parties:
        typer.echo(f"  當事人:{p.name}({p.role})")
    for label, value in [
        ("標的", kf.subject),
        ("金額", kf.amount),
        ("起始日", kf.start_date),
        ("截止日", kf.end_date),
        ("終止條件", kf.termination),
    ]:
        if value:
            typer.echo(f"  {label}:{value}")

    typer.echo(f"\n══════════ 風險條款({len(r.risks)} 項)══════════")
    for risk in r.risks:
        flag = "" if risk.verified else "(⚠ 引文未能對回原文)"
        typer.echo(f"\n  [{SEVERITY_MARKS[risk.severity]}] {RISK_TYPE_LABELS[risk.risk_type]}|{risk.title}{flag}")
        typer.echo(f"    {risk.explanation}")
        typer.echo(f"    原文:「{risk.quote[:120]}{'…' if len(risk.quote) > 120 else ''}」")

    typer.echo("\n══════════ 總評 ══════════")
    typer.echo(f"  風險分數:{r.risk_score}/100")
    typer.echo(f"  {r.summary}")


@app.command()
def doctor() -> None:
    """檢查 Ollama 服務與模型是否就緒。"""
    import httpx

    try:
        resp = httpx.get(f"{settings.ollama_base_url}/api/tags", timeout=5)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        typer.echo(f"✗ 無法連線 Ollama({settings.ollama_base_url}):{exc}")
        raise typer.Exit(1) from None
    names = {m["name"].split(":")[0] for m in resp.json().get("models", [])}
    ok = True
    for model in (settings.llm_model, settings.embed_model):
        base = model.split(":")[0]
        mark = "✓" if base in names else "✗"
        if base not in names:
            ok = False
        typer.echo(f"{mark} {model}")
    if not ok:
        typer.echo("缺少模型,請執行:ollama pull <model>")
        raise typer.Exit(1)
    typer.echo("環境就緒。")


if __name__ == "__main__":
    app()
