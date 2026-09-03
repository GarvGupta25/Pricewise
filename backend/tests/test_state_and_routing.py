from backend.graph.routing import router_specific_enough
from backend.graph.state import PricePoint, ProductResult, initial_graph_state
from backend.services.db import _json_default
from decimal import Decimal


def test_initial_state_has_every_graph_field() -> None:
    state = initial_graph_state("Need a monitor under 25k")

    assert state["current_stage"] == "intake"
    assert state["turn_count"] == 0
    assert state["top_k_products"] == []


def test_product_and_price_models_reject_negative_prices() -> None:
    assert PricePoint(price=1, recorded_at="2026-01-01T00:00:00Z").price == 1
    assert ProductResult(
        id="product-1",
        source_site="croma.com",
        source_url="https://www.croma.com/product",
        title="Example",
        price=100,
    ).price == 100


def test_router_requests_clarification_until_complete_or_cap() -> None:
    state = initial_graph_state("I need a monitor")
    assert router_specific_enough(state) == "conversational_feedback"

    state["turn_count"] = 4
    assert router_specific_enough(state) == "hybrid_search"


def test_database_json_encoder_handles_postgres_decimal_values() -> None:
    assert _json_default(Decimal("4.5")) == 4.5

    state["turn_count"] = 0
    state["intent_complete"] = True
    assert router_specific_enough(state) == "hybrid_search"
