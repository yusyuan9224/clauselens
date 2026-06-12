FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

COPY pyproject.toml uv.lock README.md ./
RUN uv sync --frozen --no-install-project --no-dev

COPY src ./src
RUN uv sync --frozen --no-dev

EXPOSE 8000
CMD ["uv", "run", "--no-sync", "uvicorn", "clauselens.server:app", "--host", "0.0.0.0", "--port", "8000"]
