import json

import httpx
import pytest
import respx
from pydantic import BaseModel

from clauselens.ollama_client import OllamaClient, StructuredOutputError

BASE = "http://ollama.test"


class Demo(BaseModel):
    name: str
    score: int


def chat_response(content: str) -> httpx.Response:
    return httpx.Response(200, json={"message": {"role": "assistant", "content": content}})


@pytest.fixture
async def client():
    c = OllamaClient(base_url=BASE)
    yield c
    await c.aclose()


@respx.mock
async def test_structured_output_success(client):
    respx.post(f"{BASE}/api/chat").mock(
        return_value=chat_response(json.dumps({"name": "a", "score": 1}))
    )
    result = await client.generate_structured("sys", "user", Demo)
    assert result == Demo(name="a", score=1)


@respx.mock
async def test_structured_output_retries_on_invalid_then_succeeds(client):
    route = respx.post(f"{BASE}/api/chat")
    route.side_effect = [
        chat_response(json.dumps({"name": "a"})),  # 缺 score → 驗證失敗
        chat_response(json.dumps({"name": "a", "score": 2})),
    ]
    result = await client.generate_structured("sys", "user", Demo, retries=3)
    assert result.score == 2
    assert route.call_count == 2
    # 第二次請求應包含錯誤回饋訊息
    second_messages = json.loads(route.calls[1].request.content)["messages"]
    assert any("不符合 JSON schema" in m["content"] for m in second_messages)


@respx.mock
async def test_structured_output_exhausts_retries(client):
    respx.post(f"{BASE}/api/chat").mock(return_value=chat_response("not json"))
    with pytest.raises(StructuredOutputError):
        await client.generate_structured("sys", "user", Demo, retries=2)


@respx.mock
async def test_embed(client):
    respx.post(f"{BASE}/api/embed").mock(
        return_value=httpx.Response(200, json={"embeddings": [[0.1, 0.2]]})
    )
    vectors = await client.embed(["hello"])
    assert vectors == [[0.1, 0.2]]
