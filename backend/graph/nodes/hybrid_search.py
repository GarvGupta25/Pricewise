"""Cache-first product retrieval with tightly constrained live fallback."""

from __future__ import annotations

import json
from typing import Any

from backend.graph.state import GraphState
from backend.services.firecrawl_client import canonical_retailer


def _candidate(record: dict[str, Any]) -> dict[str, Any] | None:
    source_url = str(record["source_url"])
    source_site = canonical_retailer(source_url)
    price = record.get("price", record.get("current_price"))
    if not source_site or not isinstance(price, int):
        return None
    specs = record.get("specs") or {}
    if isinstance(specs, str):
        try:
            specs = json.loads(specs)
        except json.JSONDecodeError:
            specs = {}
    if not isinstance(specs, dict):
        specs = {}
    return {
        **record,
        "id": str(record["id"]),
        "source_site": source_site,
        "source_url": source_url,
        "price": price,
        "specs": specs,
    }


def _search_query(state: GraphState) -> str:
    """Build a complete retailer query after multi-turn clarification.

    ``user_query`` becomes the latest human reply when the graph resumes, so
    searching it directly would turn a query into only “80000” or “video
    editing”. Rebuild from extracted state instead.
    """
    parts = [state["brand"], state["model_sku"], state["product_category"]]
    parts.extend(f"{key.replace('_', ' ')} {value}" for key, value in state["specs"].items() if value)
    if state["budget_max"] is not None:
        parts.append(f"under {state['budget_max']} INR")
    query = " ".join(str(part) for part in parts if part)
    return query or state["user_query"]


async def hybrid_search_node(
    state: GraphState, database: object, embeddings: object, scraper: object
) -> dict:
    """Search the fresh database cache, scraping only after a complete cache miss."""
    query = _search_query(state)
    exact_search = bool(state["model_sku"] or (state["brand"] and state["specs"]))
    if exact_search:
        cached = await database.find_fresh_exact_products(
            category=state["product_category"], brand=state["brand"], model_sku=state["model_sku"]
        )
    else:
        query_embedding = await embeddings.embed(query)
        cached = await database.find_fresh_vector_products(
            query_embedding, category=state["product_category"]
        )

    candidates = [item for row in cached if (item := _candidate(row))]
    if candidates:
        return {"search_candidates": candidates, "current_stage": "searching"}

    scraped = await scraper.search_products(query)
    for product in scraped:
        if not canonical_retailer(product.source_url):
            continue
        product_embedding = await embeddings.embed(product.title)
        product_id = await database.upsert_product(
            source_site=canonical_retailer(product.source_url),
            source_url=product.source_url,
            title=product.title,
            brand=product.brand,
            category=state["product_category"],
            specs=product.specs,
            current_price=product.price,
            rating=product.rating,
            review_count=product.review_count,
            embedding=product_embedding,
        )
        candidates.append(
            {
                "id": str(product_id),
                "source_site": canonical_retailer(product.source_url),
                "source_url": product.source_url,
                "title": product.title,
                "brand": product.brand,
                "price": product.price,
                "specs": product.specs,
                "rating": product.rating,
                "review_count": product.review_count,
                "relevance_score": 0.0,
            }
        )
    return {"search_candidates": candidates, "current_stage": "searching"}
