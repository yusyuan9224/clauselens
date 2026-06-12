"""Qdrant 向量庫封裝。url=None 時用 in-memory 模式(CLI / 測試零依賴)。"""

import uuid

from qdrant_client import QdrantClient
from qdrant_client import models as qm

from .chunking import Chunk
from .config import settings


class VectorStore:
    def __init__(self, url: str | None = None, collection: str | None = None) -> None:
        self.client = QdrantClient(url=url) if url else QdrantClient(location=":memory:")
        self.collection = collection or settings.collection_name

    def ensure_collection(self, dim: int | None = None) -> None:
        if not self.client.collection_exists(self.collection):
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=qm.VectorParams(
                    size=dim or settings.embed_dim, distance=qm.Distance.COSINE
                ),
            )

    def index_chunks(self, doc_id: str, chunks: list[Chunk], vectors: list[list[float]]) -> None:
        self.ensure_collection(dim=len(vectors[0]) if vectors else None)
        points = [
            qm.PointStruct(
                id=str(uuid.uuid5(uuid.NAMESPACE_OID, f"{doc_id}:{c.id}")),
                vector=v,
                payload={
                    "doc_id": doc_id,
                    "chunk_id": c.id,
                    "text": c.text,
                    "start": c.start,
                    "end": c.end,
                    "clause_no": c.clause_no,
                },
            )
            for c, v in zip(chunks, vectors, strict=True)
        ]
        self.client.upsert(collection_name=self.collection, points=points)

    def search(self, vector: list[float], doc_id: str | None = None, top_k: int = 5) -> list[dict]:
        flt = None
        if doc_id:
            flt = qm.Filter(
                must=[qm.FieldCondition(key="doc_id", match=qm.MatchValue(value=doc_id))]
            )
        hits = self.client.query_points(
            collection_name=self.collection, query=vector, query_filter=flt, limit=top_k
        ).points
        return [{"score": h.score, **(h.payload or {})} for h in hits]

    def delete_doc(self, doc_id: str) -> None:
        self.client.delete(
            collection_name=self.collection,
            points_selector=qm.FilterSelector(
                filter=qm.Filter(
                    must=[qm.FieldCondition(key="doc_id", match=qm.MatchValue(value=doc_id))]
                )
            ),
        )
