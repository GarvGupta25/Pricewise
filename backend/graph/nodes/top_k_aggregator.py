"""Defense-in-depth filtering, de-duplication, and ranking of shopping results."""

from __future__ import annotations

import json
import re
from typing import Any

from backend.graph.state import GraphState, ProductResult
from backend.services.firecrawl_client import canonical_retailer


def _normalise(value: str | None) -> str:
    return re.sub(r"\W+", " ", value.lower() if value else "").strip()


def _dedupe_key(candidate: dict[str, Any]) -> tuple[str, str, str]:
    return (
        _normalise(str(candidate.get("title", ""))),
        _normalise(candidate.get("brand")),
        json.dumps(candidate.get("specs") or {}, sort_keys=True),
    )


def _rank(candidate: dict[str, Any]) -> tuple[float, float, int]:
    return (
        float(candidate.get("relevance_score") or candidate.get("match_confidence") or 0),
        float(candidate.get("rating") or 0),
        int(candidate.get("review_count") or 0),
    )


async def top_k_aggregator_node(state: GraphState) -> dict:
    chosen: dict[tuple[str, str, str], dict[str, Any]] = {}
    for candidate in state["search_candidates"]:
        if not canonical_retailer(str(candidate.get("source_url", ""))):
            continue
        try:
            product = ProductResult.model_validate(
                {
                    **candidate,
                    "source_site": canonical_retailer(candidate["source_url"]),
                    "price": candidate.get("price", candidate.get("current_price")),
                }
            )
        except ValueError:
            continue
        normalised = {**candidate, **product.model_dump()}
        key = _dedupe_key(normalised)
        previous = chosen.get(key)
        if previous is None or normalised["price"] < previous["price"]:
            chosen[key] = normalised

    ranked = sorted(chosen.values(), key=_rank, reverse=True)[:5]
    return {
        "top_k_products": [ProductResult.model_validate(item) for item in ranked],
        "current_stage": "comparing",
    }
