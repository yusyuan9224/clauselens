# 貢獻指南 / Contributing

感謝你考慮為 ClauseLens 做出貢獻!Issues 與 PR 都歡迎,繁中或英文皆可。

## 開發環境

前置需求:[Ollama](https://ollama.com)、[uv](https://docs.astral.sh/uv/)、Node 22 + pnpm、Docker(選用)。

```bash
# 模型
ollama pull qwen2.5:7b && ollama pull bge-m3

# 後端
cd backend
uv sync
uv run clauselens doctor          # 檢查環境
uv run uvicorn clauselens.server:app --port 8000 --reload

# 前端(另一個終端機)
cd frontend
pnpm install
pnpm dev
```

## 提交前檢查

```bash
cd backend && uv run ruff check src tests && uv run pytest -q
cd frontend && pnpm lint && pnpm build
```

評測(需要 Ollama,非 CI 必跑):

```bash
cd backend && uv run python evals/run_eval.py
```

## PR 約定

- 一個 PR 解決一件事,附上動機說明
- 新功能請附測試;修 bug 請附重現該 bug 的測試
- commit message 用祈使句(`feat: ...` / `fix: ...` / `docs: ...`)

## 哪裡可以幫上忙

- 標 [`good first issue`](https://github.com/yusyuan9224/clauselens/issues?q=label%3A%22good+first+issue%22) 的 issue
- 新的風險條款類型與評測樣本(`backend/evals/`)
- 各類合約範例(去識別化後的真實合約結構)
