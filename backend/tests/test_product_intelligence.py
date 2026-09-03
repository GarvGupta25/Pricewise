from datetime import date, datetime, timezone
from uuid import uuid4

import pytest

from backend.graph.nodes.final_decision import decide
from backend.graph.nodes.historical_price_tracker import historical_price_tracker_node
from backend.graph.nodes.holiday_trend import holiday_trend_node
from backend.graph.nodes.top_k_aggregator import top_k_aggregator_node
from backend.graph.state import ProductResult, initial_graph_state
from backend.services.firecrawl_client import _native_product_price, _price_from_markdown


@pytest.mark.asyncio
async def test_aggregator_filters_unapproved_and_keeps_lowest_duplicate_price() -> None:
    state = initial_graph_state("monitor")
    state["search_candidates"] = [
        {"id": "1", "source_url": "https://amazon.in/a", "source_site": "amazon.in", "title": "View 27", "brand": "View", "price": 20000, "specs": {}},
        {"id": "2", "source_url": "https://flipkart.com/b", "source_site": "flipkart.com", "title": "View 27", "brand": "View", "price": 19000, "specs": {}},
        {"id": "3", "source_url": "https://unapproved.example/a", "source_site": "example", "title": "Bad", "price": 1, "specs": {}},
    ]
    result = await top_k_aggregator_node(state)

    assert [item.id for item in result["top_k_products"]] == ["2"]


class FakeDatabase:
    async def get_price_history(self, _: str):
        return [
            {"price": 20000, "recorded_at": datetime(2026, 1, 1, tzinfo=timezone.utc)},
            {"price": 19000, "recorded_at": datetime(2026, 2, 1, tzinfo=timezone.utc)},
        ]

    async def get_price_stats(self, _: str):
        return {"all_time_low": 19000, "avg_90_day": 19500}


@pytest.mark.asyncio
async def test_price_tracker_labels_fewer_than_three_observations() -> None:
    state = initial_graph_state("monitor")
    state["top_k_products"] = [ProductResult(id="1", source_site="amazon.in", source_url="https://amazon.in/a", title="View", price=20000, specs={})]
    state["search_candidates"] = [{"id": "1", "price": 20000}]
    result = await historical_price_tracker_node(state, FakeDatabase())

    assert result["search_candidates"][0]["price_data_status"] == "insufficient_data"
    assert len(result["price_history"]["1"]) == 2


@pytest.mark.asyncio
async def test_calendar_and_decision_are_deterministic() -> None:
    state = initial_graph_state("monitor")
    calendar = await holiday_trend_node(state, today=date(2026, 1, 10))

    assert calendar["upcoming_sale"].name == "Republic Day Sale"
    assert decide({"price": 12000, "all_time_low": 11000, "price_data_status": "ready"}, calendar["upcoming_sale"]) == "wait"
    assert decide({"price": 11000, "all_time_low": 11000, "price_data_status": "ready"}, None) == "buy_now"


def test_firecrawl_price_fallbacks_preserve_whole_inr() -> None:
    assert _native_product_price({"variants": [{"price": {"amount": 24999}}]}) == 24999
    assert _price_from_markdown("Now only ₹24,999") == 24999
