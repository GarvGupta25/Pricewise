"""Offline end-to-end graph smoke test; no API keys or retail data are invented by the app."""

from __future__ import annotations

import asyncio

from backend.graph.graph_builder import GraphDependencies, build_graph
from backend.graph.nodes.final_decision import FinalWording
from backend.graph.nodes.intent_extractor import IntentExtraction
from backend.graph.state import initial_graph_state


class DemoLlm:
    async def structured_completion(self, *, schema: type, **_: object):
        if schema is IntentExtraction:
            return IntentExtraction(
                product_category="laptop", specs={"use_case": "coding"}, budget_max=80000
            )
        return FinalWording(response="Demo completed with structured, supplied evidence only.")


class DemoEmbeddings:
    async def embed(self, _: str) -> list[float]:
        return [0.0] * 768


class DemoDatabase:
    async def find_fresh_vector_products(self, _: list[float]):
        return [{"id": "demo-product", "source_site": "croma.com", "source_url": "https://www.croma.com/demo", "title": "Demo Laptop", "brand": "Demo", "current_price": 70000, "specs": {"use_case": "coding"}, "rating": 4.4, "review_count": 25}]

    async def get_price_history(self, _: str):
        return [{"price": 70000, "recorded_at": "2026-01-01T00:00:00Z"}, {"price": 71000, "recorded_at": "2026-02-01T00:00:00Z"}, {"price": 70000, "recorded_at": "2026-03-01T00:00:00Z"}]

    async def get_price_stats(self, _: str):
        return {"all_time_low": 70000, "avg_90_day": 70333, "history_points": 3}


class NoLiveScrape:
    async def search_products(self, _: str):
        raise AssertionError("The smoke test should hit the supplied fresh cache.")


async def main() -> None:
    graph = build_graph(GraphDependencies(DemoLlm(), DemoDatabase(), DemoEmbeddings(), NoLiveScrape()))
    result = await graph.ainvoke(
        initial_graph_state("I need a coding laptop under 80k"),
        config={"configurable": {"thread_id": "offline-smoke-test"}},
    )
    assert result["current_stage"] == "done"
    assert result["recommendation"] == "buy_now"
    print("Graph smoke test passed: deterministic decision reached with cache data.")


if __name__ == "__main__":
    asyncio.run(main())
