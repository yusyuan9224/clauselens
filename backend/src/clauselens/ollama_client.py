"""Ollama API 封裝:embedding 與強制 JSON schema 的結構化輸出。

structured output 用 Ollama 的 format 參數(傳入 JSON schema),
搭配 Pydantic 驗證 + 失敗重試(把驗證錯誤回饋給模型),
讓 7B 本地模型也能穩定吐出合法 schema。
"""

import json
from typing import TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from .config import settings

T = TypeVar("T", bound=BaseModel)


class StructuredOutputError(RuntimeError):
    """重試耗盡仍無法取得合法 JSON。"""


class OllamaClient:
    def __init__(self, base_url: str | None = None, timeout: float | None = None) -> None:
        self.base_url = (base_url or settings.ollama_base_url).rstrip("/")
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=timeout or settings.llm_timeout)

    async def aclose(self) -> None:
        await self._client.aclose()

    async def embed(self, texts: list[str], model: str | None = None) -> list[list[float]]:
        resp = await self._client.post(
            "/api/embed", json={"model": model or settings.embed_model, "input": texts}
        )
        resp.raise_for_status()
        return resp.json()["embeddings"]

    async def chat(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        format_schema: dict | None = None,
        temperature: float = 0.0,
    ) -> str:
        payload: dict = {
            "model": model or settings.llm_model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if format_schema is not None:
            payload["format"] = format_schema
        resp = await self._client.post("/api/chat", json=payload)
        resp.raise_for_status()
        return resp.json()["message"]["content"]

    async def generate_structured(
        self,
        system: str,
        user: str,
        schema: type[T],
        retries: int | None = None,
    ) -> T:
        """強制結構化輸出:format=JSON schema → Pydantic 驗證 → 失敗附錯誤重試。"""
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        last_error: Exception | None = None
        for _ in range(retries if retries is not None else settings.llm_retries):
            content = await self.chat(messages, format_schema=schema.model_json_schema())
            try:
                return schema.model_validate_json(content)
            except ValidationError as exc:
                last_error = exc
                messages.append({"role": "assistant", "content": content})
                messages.append(
                    {
                        "role": "user",
                        "content": "上一個回覆不符合 JSON schema,錯誤:"
                        f"{json.dumps(exc.errors(), ensure_ascii=False, default=str)[:800]}\n"
                        "請重新輸出完全符合 schema 的 JSON,不要包含其他文字。",
                    }
                )
        raise StructuredOutputError(
            f"重試 {retries or settings.llm_retries} 次後仍無法取得合法輸出:{last_error}"
        )
