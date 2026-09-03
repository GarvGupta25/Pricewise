"""Firecrawl product search, constrained before and after every request."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse
import re

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


class _ProductExtraction(BaseModel):
    """Fields Firecrawl extracts from a known product-page URL."""

    title: str | None = None
    brand: str | None = None
    price: int | None = Field(default=None, ge=0, description="Whole INR only")
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

    async def search_products(self, query: str, *, limit: int = 3) -> list[ScrapedProduct]:
        if not self._api_key:
            raise ServiceConfigurationError("FIRECRAWL_API_KEY is required when the cache is stale.")
        # Search only discovers approved retailer URLs. JSON extraction belongs
        # to /v2/scrape, not /v2/search (which otherwise returns HTTP 400).
        async with httpx.AsyncClient(timeout=60) as client:
            search_response = await client.post(
                "https://api.firecrawl.dev/v2/search",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "query": query,
                    "sources": ["web"],
                    "includeDomains": sorted(RETAILER_ALLOWLIST),
                    "country": "IN",
                    "limit": limit,
                    "ignoreInvalidURLs": True,
                },
            )
            if search_response.is_error:
                raise RuntimeError(_firecrawl_error("search", search_response))
            data = search_response.json().get("data", {})
            pages = data.get("web", []) if isinstance(data, dict) else []
            urls = [str(page.get("url", "")) for page in pages if canonical_retailer(str(page.get("url", "")))]
            products: list[ScrapedProduct] = []
            for url in urls[:limit]:
                product = await self._scrape_product(client, url)
                if product is not None:
                    products.append(product)
        return products

    async def _scrape_product(self, client: httpx.AsyncClient, url: str) -> ScrapedProduct | None:
        response = await client.post(
            "https://api.firecrawl.dev/v2/scrape",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "url": url,
                "formats": [
                    "markdown",
                    {"type": "json", "schema": _ProductExtraction.model_json_schema(), "prompt": _EXTRACTION_PROMPT},
                ],
                "onlyMainContent": True,
                "timeout": 60000,
            },
        )
        if response.is_error:
            raise RuntimeError(_firecrawl_error("product scrape", response))
        data = response.json().get("data", {})
        if not isinstance(data, dict):
            return None
        structured = data.get("json") if isinstance(data.get("json"), dict) else {}
        try:
            extracted = _ProductExtraction.model_validate(structured)
            native_product = data.get("product") if isinstance(data.get("product"), dict) else {}
            title = extracted.title or native_product.get("title") or data.get("metadata", {}).get("title")
            price = extracted.price or _native_product_price(native_product) or _price_from_markdown(data.get("markdown", ""))
            if not isinstance(title, str) or not isinstance(price, int) or price <= 0:
                return None
            # Firecrawl JSON schemas require fixed object properties. Product
            # specs remain a database field, but are populated later from a
            # retailer-specific parser rather than an open-ended LLM object.
            return ScrapedProduct(
                source_url=url,
                title=title,
                brand=extracted.brand or native_product.get("brand"),
                price=price,
                specs={},
                rating=extracted.rating,
                review_count=extracted.review_count,
            )
        except ValueError:
            return None


def _firecrawl_error(operation: str, response: httpx.Response) -> str:
    """Return the provider's small response body without leaking credentials."""
    body = response.text.replace("\n", " ").strip()[:500]
    return f"Firecrawl {operation} failed ({response.status_code}): {body or 'no error details returned'}"


def _native_product_price(product: dict[str, Any]) -> int | None:
    variants = product.get("variants")
    if not isinstance(variants, list):
        return None
    for variant in variants:
        price = variant.get("price", {}) if isinstance(variant, dict) else {}
        amount = price.get("amount") if isinstance(price, dict) else None
        if isinstance(amount, (int, float)) and amount > 0:
            return int(round(amount))
    return None


def _price_from_markdown(markdown: str) -> int | None:
    """Conservative fallback for a displayed INR price when extraction omits it."""
    match = re.search(r"(?:₹|INR\s?)(\d{1,3}(?:,\d{2,3})+|\d{3,7})", markdown)
    if not match:
        return None
    return int(match.group(1).replace(",", ""))
