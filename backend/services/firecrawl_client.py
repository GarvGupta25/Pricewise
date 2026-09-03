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
        # Search only discovers approved retailer URLs. A single broad web
        # search tends to rank collection pages ("32-inch monitors") above
        # purchasable pages. Query each retailer separately, then scrape only
        # URLs that look like individual product pages.
        # JSON extraction belongs to /v2/scrape, not /v2/search.
        async with httpx.AsyncClient(timeout=60) as client:
            urls = await self._discover_product_urls(client, query, target_count=limit)
            products: list[ScrapedProduct] = []
            for url in urls:
                product = await self._scrape_product(client, url)
                if product is not None:
                    products.append(product)
                if len(products) >= limit:
                    break
        return products

    async def _discover_product_urls(self, client: httpx.AsyncClient, query: str, *, target_count: int) -> list[str]:
        """Return actual product URLs, never retailer/search/category pages."""
        urls: list[str] = []
        seen: set[str] = set()
        retailer_query = _retailer_query(query)
        # Start with retailers whose search indexes consistently surface
        # product detail pages. The remaining approved retailers are used if
        # we still need candidates.
        retailer_order = ("mdcomputers.in", "croma.com", "reliancedigital.in", "flipkart.com", "amazon.in")
        for domain in retailer_order:
            response = await client.post(
                "https://api.firecrawl.dev/v2/search",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "query": f"{retailer_query} buy",
                    "sources": ["web"],
                    "includeDomains": [domain],
                    "country": "IN",
                    "limit": 6,
                    "ignoreInvalidURLs": True,
                },
            )
            if response.is_error:
                # A temporarily blocked retailer should not prevent results
                # from the other approved retailers.
                continue
            data = response.json().get("data", {})
            pages = data.get("web", []) if isinstance(data, dict) else []
            for page in pages:
                url = str(page.get("url", "")) if isinstance(page, dict) else ""
                title = str(page.get("title", "")) if isinstance(page, dict) else ""
                if (
                    url in seen
                    or not canonical_retailer(url)
                    or not _looks_like_product_url(url)
                    or not _looks_relevant(title, retailer_query)
                ):
                    continue
                seen.add(url)
                urls.append(url)
                if len(urls) >= target_count * 3:
                    return urls
        return urls

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


def _looks_like_product_url(url: str) -> bool:
    """Conservative retailer-agnostic guard against category/search pages."""
    path = urlparse(url).path.lower().rstrip("/")
    product_markers = ("/product/", "/dp/", "/p/", "/item/", "/products/")
    if any(marker in path for marker in product_markers):
        return True
    # Flipkart product URLs usually end in an itm identifier rather than
    # consistently using a product path segment.
    return "/p/itm" in path or "itm" in path.rsplit("/", 1)[-1]


def _retailer_query(query: str) -> str:
    """Remove field labels and budget wording that confuse retailer search."""
    query = re.sub(r"\b(?:size|resolution|screen size|display size)\b", " ", query, flags=re.IGNORECASE)
    query = re.sub(r"\bunder\s+[\d,]+\s+inr\b", " ", query, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", query).strip()


def _looks_relevant(title: str, query: str) -> bool:
    """Reject obvious off-category search hits before spending a scrape credit."""
    title = title.lower()
    category_aliases = {
        "monitor": ("monitor", "display"),
        "laptop": ("laptop", "notebook", "macbook"),
        "phone": ("phone", "smartphone", "iphone", "mobile"),
        "mobile": ("phone", "smartphone", "iphone", "mobile"),
        "television": ("television", " tv", "smart tv"),
        "headphone": ("headphone", "earphone", "earbud"),
    }
    query_words = set(re.findall(r"[a-z]+", query.lower()))
    for category, aliases in category_aliases.items():
        if category in query_words:
            return any(alias in title for alias in aliases)
    return True
