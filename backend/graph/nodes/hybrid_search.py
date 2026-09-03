"""Cache-first product retrieval with tightly constrained live fallback."""

from __future__ import annotations

from typing import Any

from backend.graph.state import GraphState
from backend.services.firecrawl_client import canonical_retailer


def _candidate(record: dict[str, Any]) -> dict[str, Any] | None:
    source_url = str(record["source_url"])
    source_site = canonical_retailer(source_url)
    price = record.get("price", record.get("current_price"))
    if not source_site or not isinstance(price, int):
        return None
    return {
        **record,
        "id": str(record["id"]),
        "source_site": source_site,
        "source_url": source_url,
        "price": price,
        "specs": record.get("specs") or {},
    }


async def hybrid_search_node(
    state: GraphState, database: object, embeddings: object, scraper: object
) -> dict:
    """Search the fresh database cache, scraping only after a complete cache miss."""
    exact_search = bool(state["model_sku"] or (state["brand"] and state["specs"]))
    if exact_search:
        cached = await database.find_fresh_exact_products(
            category=state["product_category"], brand=state["brand"], model_sku=state["model_sku"]
        )
    else:
        query_embedding = await embeddings.embed(state["user_query"])
        cached = await database.find_fresh_vector_products(query_embedding)

    candidates = [item for row in cached if (item := _candidate(row))]
    if candidates:
        return {"search_candidates": candidates, "current_stage": "searching"}

    scraped = await scraper.search_products(state["user_query"])
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
