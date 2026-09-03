"""Firecrawl product search, constrained before and after every request."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, Field

from backend.config import RETAILER_ALLOWLIST

from .groq_client import ServiceConfigurationError


class ScrapedProduct(BaseModel):
    source_url: str
    title: str
    brand: str | None = None
    price: int = Field(ge=0, description="Whole INR only")
    specs: dict[str, Any] = Field(default_factory=dict)
    rating: float | None = None
    review_count: int | None = Field(default=None, ge=0)


_EXTRACTION_PROMPT = (
    "Extract one purchasable product only. Return its displayed current price in whole INR, "
    "not an EMI amount or discount. Do not estimate missing values."
)


def canonical_retailer(url: str) -> str | None:
    host = (urlparse(url).hostname or "").lower().rstrip(".")
    for domain in RETAILER_ALLOWLIST:
        if host == domain or host.endswith(f".{domain}"):
            return domain
    return None


class FirecrawlClient:
    """Uses Firecrawl v2 search with its domain filter and validates URLs again."""

    def __init__(self, api_key: str | None) -> None:
        self._api_key = api_key

    async def search_products(self, query: str, *, per_domain_limit: int = 3) -> list[ScrapedProduct]:
        if not self._api_key:
            raise ServiceConfigurationError("FIRECRAWL_API_KEY is required when the cache is stale.")
        results: list[ScrapedProduct] = []
        async with httpx.AsyncClient(timeout=60) as client:
            for domain in sorted(RETAILER_ALLOWLIST):
                response = await client.post(
                    "https://api.firecrawl.dev/v2/search",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json={
                        "query": query,
                        "includeDomains": [domain],
                        "country": "IN",
                        "limit": per_domain_limit,
                        "scrapeOptions": {
                            "formats": [
                                {
                                    "type": "json",
                                    "schema": ScrapedProduct.model_json_schema(),
                                    "prompt": _EXTRACTION_PROMPT,
                                }
                            ]
                        },
                    },
                )
                response.raise_for_status()
                results.extend(self._structured_products(response.json()))
        return results

    @staticmethod
    def _structured_products(payload: dict[str, Any]) -> list[ScrapedProduct]:
        data = payload.get("data", {})
        pages = data.get("web", []) if isinstance(data, dict) else data
        products: list[ScrapedProduct] = []
        for page in pages if isinstance(pages, list) else []:
            structured = page.get("json") or page.get("structuredData")
            if not isinstance(structured, dict):
                continue
            structured.setdefault("source_url", page.get("url"))
            if not canonical_retailer(str(structured.get("source_url", ""))):
                continue
            try:
                products.append(ScrapedProduct.model_validate(structured))
            except ValueError:
                continue
        return products
