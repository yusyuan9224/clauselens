"""風險辨識評測:跑真實 LLM,對照 expectations.json 計算 recall 與引文驗證率。

用法:uv run python evals/run_eval.py [--runs 1]
非 CI 用(需要 Ollama);CI 只跑單元測試。
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from clauselens.analyzer import analyze_document
from clauselens.ollama_client import OllamaClient
from clauselens.parsing import parse_file

EVALS_DIR = Path(__file__).parent
EXAMPLES_DIR = EVALS_DIR.parent.parent / "examples"


def match_expected(expected: dict, risks: list) -> bool:
    """預期風險被命中 = 任一 finding 的引文含關鍵字,且類型在可接受集合內。"""
    for r in risks:
        if expected["quote_keyword"] in r.quote and r.risk_type in expected["types"]:
            return True
    return False


async def run() -> dict:
    expectations = json.loads((EVALS_DIR / "expectations.json").read_text(encoding="utf-8"))
    ollama = OllamaClient()
    results = {}
    try:
        for filename, spec in expectations.items():
            parsed = parse_file(EXAMPLES_DIR / filename)
            report = await analyze_document(parsed, ollama, store=None, doc_id=filename)

            hits = [e["name"] for e in spec["expected_risks"] if match_expected(e, report.risks)]
            misses = [e["name"] for e in spec["expected_risks"] if e["name"] not in hits]
            kf = report.key_fields.model_dump()
            kf_hits = [
                f for f in spec["key_fields_required"]
                if (kf.get(f) if f != "parties" else kf["parties"])
            ]
            verified = [r for r in report.risks if r.verified]

            results[filename] = {
                "risk_recall": f"{len(hits)}/{len(spec['expected_risks'])}",
                "hits": hits,
                "misses": misses,
                "key_fields": f"{len(kf_hits)}/{len(spec['key_fields_required'])}",
                "key_fields_missing": [f for f in spec["key_fields_required"] if f not in kf_hits],
                "citation_verified": f"{len(verified)}/{len(report.risks)}",
                "total_findings": len(report.risks),
                "severities": {s: sum(1 for r in report.risks if r.severity == s) for s in ("high", "medium", "low")},
            }
            print(f"\n=== {filename} ===")
            print(json.dumps(results[filename], ensure_ascii=False, indent=2))
    finally:
        await ollama.aclose()

    total_expected = sum(len(s["expected_risks"]) for s in expectations.values())
    total_hits = sum(len(r["hits"]) for r in results.values())
    summary = {"overall_risk_recall": f"{total_hits}/{total_expected}", "per_file": results}
    out = EVALS_DIR / "last_result.json"
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n總風險召回:{total_hits}/{total_expected}(結果存於 {out})")
    return summary


if __name__ == "__main__":
    argparse.ArgumentParser(description=__doc__).parse_args()
    summary = asyncio.run(run())
    hits, total = map(int, summary["overall_risk_recall"].split("/"))
    sys.exit(0 if hits / total >= 0.7 else 1)
