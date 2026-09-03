"""Deterministic recommendation followed by constrained natural-language wording."""

from __future__ import annotations

import json
from typing import Any, Literal

from pydantic import BaseModel

from backend.graph.state import GraphState


class FinalWording(BaseModel):
    response: str


def decide(
    product: dict[str, Any] | None, upcoming_sale: object | None
) -> Literal["buy_now", "wait", "insufficient_data"]:
    if not product:
        return "insufficient_data"
    if product.get("price_data_status") == "insufficient_data":
        return "insufficient_data"
    current_price = product.get("price", product.get("current_price"))
    all_time_low = product.get("all_time_low")
    if not isinstance(current_price, (int, float)) or not isinstance(all_time_low, (int, float)):
        return "insufficient_data"
    at_historical_low = current_price <= all_time_low * 1.02
    if at_historical_low and not upcoming_sale:
        return "buy_now"
    if upcoming_sale and not at_historical_low:
        return "wait"
    return "buy_now"


async def final_decision_node(state: GraphState, llm: object) -> dict:
    candidates = {str(item["id"]): item for item in state["search_candidates"]}
    lead = candidates.get(str(state["top_k_products"][0].id)) if state["top_k_products"] else None
    recommendation = decide(lead, state["upcoming_sale"])
    evidence = {
        "recommendation": recommendation,
        "upcoming_sale": state["upcoming_sale"].model_dump() if state["upcoming_sale"] else None,
        "products": [
            {
                **product.model_dump(),
                "history": [point.model_dump() for point in state["price_history"].get(str(product.id), [])],
                "price_analysis": candidates.get(str(product.id), {}).get("price_data_status"),
                "all_time_low": candidates.get(str(product.id), {}).get("all_time_low"),
                "avg_90_day": candidates.get(str(product.id), {}).get("avg_90_day"),
            }
            for product in state["top_k_products"]
        ],
    }
    wording: FinalWording = await llm.structured_completion(
        system_prompt=(
            "Write a concise shopping recommendation using only the supplied JSON evidence. "
            "Include actual product names, INR prices, source links, and the stated reasoning. "
            "Do not introduce facts, discounts, prices, or links not present in the evidence."
        ),
        messages=[{"role": "user", "content": json.dumps(evidence)}],
        schema=FinalWording,
    )
    return {
        "recommendation": recommendation,
        "final_response": wording.response,
        "current_stage": "done",
    }
