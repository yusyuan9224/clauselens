"""全域設定:環境變數前綴 CLAUSELENS_,例如 CLAUSELENS_OLLAMA_BASE_URL。"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CLAUSELENS_", env_file=".env", extra="ignore")

    ollama_base_url: str = "http://localhost:11434"
    llm_model: str = "qwen2.5:7b"
    embed_model: str = "bge-m3"
    embed_dim: int = 1024

    # None 時使用 in-memory Qdrant(CLI / 測試);Web 服務以 docker 內 Qdrant URL 覆寫
    qdrant_url: str | None = None
    collection_name: str = "clauselens_chunks"

    llm_timeout: float = 300.0
    llm_retries: int = 3
    chunk_max_chars: int = 600
    chunk_overlap: int = 80
    # 檢查清單掃描:每種風險類型對每個視窗做一次聚焦詢問
    scan_window_chars: int = 3000
    scan_concurrency: int = 3


settings = Settings()
