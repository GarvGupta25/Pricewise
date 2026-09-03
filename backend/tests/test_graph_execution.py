import pytest

from backend.graph.graph_builder import GraphDependencies, build_graph
from backend.graph.nodes.final_decision import FinalWording
from backend.graph.nodes.intent_extractor import IntentExtraction
from backend.graph.state import initial_graph_state


class FakeLlm:
    async def structured_completion(self, *, schema: type, **_: object):
        if schema is IntentExtraction:
            return IntentExtraction(product_category="laptop", specs={"use_case": "coding"}, budget_max=80000)
        return FinalWording(response="Evidence-based result.")


class FakeEmbeddings:
    async def embed(self, _: str) -> list[float]:
        return [0.0] * 768


class FakeDatabase:
    async def find_fresh_vector_products(self, _: list[float], *, category: str | None):
        return [{"id": "1", "source_site": "amazon.in", "source_url": "https://amazon.in/item", "title": "Laptop", "current_price": 70000, "specs": {}}]

    async def get_price_history(self, _: str):
        return [{"price": 70000, "recorded_at": "2026-01-01T00:00:00Z"}] * 3

    async def get_price_stats(self, _: str):
        return {"all_time_low": 70000, "avg_90_day": 70000}


class NoScraper:
    async def search_products(self, _: str):
        raise AssertionError("Fresh cache should avoid a live scrape.")


@pytest.mark.asyncio
async def test_compiled_graph_completes_from_fresh_cache() -> None:
    graph = build_graph(GraphDependencies(FakeLlm(), FakeDatabase(), FakeEmbeddings(), NoScraper()))
    result = await graph.ainvoke(
        initial_graph_state("coding laptop under 80k"),
        config={"configurable": {"thread_id": "test-complete"}},
    )

    assert result["recommendation"] == "buy_now"
    assert result["final_response"] == "Evidence-based result."
    assert result["current_stage"] == "done"
