from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from backend.main import create_app
from backend.jobs.refresh_prices import refresh_prices
from backend.services.firecrawl_client import ScrapedProduct


def test_product_price_refresh_is_bounded_and_serializable(monkeypatch) -> None:
    product_id = UUID("11111111-1111-1111-1111-111111111111")

    class FakeDatabase:
        async def get_product_prices(self, product_ids):
            assert product_ids == [product_id]
            return [{"id": product_id, "title": "Phone", "source_site": "croma.com", "current_price": 19999}]

        async def close(self):
            pass

    app = create_app()
    app.state.shopping_database = FakeDatabase()

    async def ready_graph(_app):
        return object()

    monkeypatch.setattr("backend.routers.chat._get_graph", ready_graph)
    with TestClient(app) as client:
        response = client.post("/products/prices", json={"product_ids": [str(product_id)]})

    assert response.status_code == 200
    assert response.json()["products"][0]["current_price"] == 19999


@pytest.mark.asyncio
async def test_scheduled_refresh_continues_after_one_product_failure() -> None:
    class FakeDatabase:
        async def get_tracked_products(self):
            return [{"id": "1", "source_url": "https://croma.com/product/1"}, {"id": "2", "source_url": "https://croma.com/product/2"}]

        async def record_tracked_price(self, product_id, price):
            assert (product_id, price) == ("2", 18999)
            return True

    class FakeScraper:
        async def refresh_product(self, url):
            if url.endswith("/1"):
                raise RuntimeError("retailer unavailable")
            return ScrapedProduct(source_url=url, title="Phone", price=18999)

    assert await refresh_prices(FakeDatabase(), FakeScraper()) == {"checked": 2, "changed": 1, "failed": 1}
