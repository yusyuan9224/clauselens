# ClauseLens 📜🔍

> **第一個真正本地、繁中優先的開源合約風險審查器**
> 100% 離線運行 — 你的合約永遠不離開你的電腦。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/yusyuan9224/clauselens/actions/workflows/ci.yml/badge.svg)](https://github.com/yusyuan9224/clauselens/actions)

## 為什麼需要 ClauseLens?

收到一份合約 — 租約、勞動契約、外包協議 — 你**不敢把它上傳到 ChatGPT**(機密外洩風險),自己又看不懂哪些條款有坑。市面上的合約審查工具不是要付費上雲,就是英文/企業導向。

**ClauseLens 完全在你的電腦上運行**:本地 LLM(Ollama + Qwen2.5)、本地 embedding、本地向量庫。零 API 費用、零資料外流。

## 核心功能

- 📄 **上傳合約**(PDF / Word / 純文字)→ 本地解析、切塊、向量化
- ⚠️ **自動標出風險條款**:自動續約、高額違約金、競業禁止、不利終止條件、模糊期限
- 🗂️ **關鍵欄位結構化抽取**:雙方當事人、標的、金額、起訖日、終止條件
- 🔗 **每個結論附原文出處**,點擊回跳並高亮原文(降低幻覺)
- 📊 **風險評分總覽** + 可匯出報告

## 快速開始

```bash
git clone https://github.com/yusyuan9224/clauselens.git
cd clauselens
docker compose up
```

開啟 http://localhost:3000 即可使用。

> 詳細安裝步驟(含 Ollama 模型下載)請見下方[安裝說明](#安裝說明)。

## 架構

```
(架構圖 — v1.0 前補上)
Next.js UI ── FastAPI ── Ollama (qwen2.5:7b / bge-m3)
                  │
               Qdrant(向量庫)
```

## Roadmap

- [ ] v0.1 — CLI 跑通:合約 → 關鍵欄位抽取 + 風險條款列表
- [ ] v0.3 — Web UI:上傳、結果卡片、原文高亮回跳
- [ ] v0.6 — JSON schema 穩定輸出 + citation + 風險評分;Docker 一鍵啟動
- [ ] v0.8 — 繁中優化、few-shot 提升風險辨識準確率;測試集
- [ ] v1.0 — 完整文件、測試、CI、正式發佈

## 技術棧

| 層級 | 選型 |
|------|------|
| 前端 | Next.js (App Router) + TypeScript + Tailwind + shadcn/ui |
| 後端 | FastAPI (Python 3.12, uv) |
| LLM | Ollama + Qwen2.5 7B(繁中能力強) |
| Embedding | bge-m3(經 Ollama,中文檢索效果佳) |
| 向量庫 | Qdrant |
| 文件解析 | PyMuPDF / python-docx |
| 部署 | Docker + docker-compose |

## 安裝說明

(v0.6 Docker 化後補完整步驟)

## License

[MIT](LICENSE)
