"""Local Ollama embeddings adapter."""

from __future__ import annotations

import httpx

from .groq_client import ServiceConfigurationError


class OllamaEmbeddings:
    def __init__(self, base_url: str, model: str = "nomic-embed-text") -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def embed(self, text: str) -> list[float]:
        if not text.strip():
            raise ValueError("Cannot embed an empty string.")
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.post(
                    f"{self._base_url}/api/embeddings",
                    json={"model": self._model, "prompt": text},
                )
                response.raise_for_status()
        except httpx.HTTPError as error:
            raise ServiceConfigurationError(
                "Ollama is unavailable. Start Ollama and pull nomic-embed-text."
            ) from error
        embedding = response.json().get("embedding")
        if not isinstance(embedding, list) or not embedding:
            raise RuntimeError("Ollama returned no embedding.")
        return [float(value) for value in embedding]
