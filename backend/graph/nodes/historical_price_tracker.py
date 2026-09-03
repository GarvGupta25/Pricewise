"""Load real stored prices and explicitly label thin history."""

from __future__ import annotations

from decimal import Decimal

from backend.graph.state import GraphState, PricePoint


def _number(value: object) -> float | int | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    return value  # type: ignore[return-value]


async def historical_price_tracker_node(state: GraphState, database: object) -> dict:
    histories: dict[str, list[PricePoint]] = {}
    candidates_by_id = {str(item["id"]): item for item in state["search_candidates"]}
    refreshed_candidates = [dict(item) for item in state["search_candidates"]]
    refreshed_by_id = {str(item["id"]): item for item in refreshed_candidates}

    for product in state["top_k_products"]:
        product_id = str(product.id)
        rows = await database.get_price_history(product_id)
        history = [
            PricePoint(price=int(row["price"]), recorded_at=row["recorded_at"].isoformat()
            if hasattr(row["recorded_at"], "isoformat") else str(row["recorded_at"]))
            for row in rows
        ]
        histories[product_id] = history
        stats = await database.get_price_stats(product_id)
        candidate = refreshed_by_id.get(product_id, candidates_by_id.get(product_id))
        if candidate is not None:
            candidate["history_points"] = len(history)
            candidate["price_data_status"] = "ready" if len(history) >= 3 else "insufficient_data"
            if stats:
                candidate["all_time_low"] = _number(stats.get("all_time_low"))
                candidate["avg_90_day"] = _number(stats.get("avg_90_day"))

    return {
        "price_history": histories,
        "search_candidates": refreshed_candidates,
        "current_stage": "checking_prices",
    }
