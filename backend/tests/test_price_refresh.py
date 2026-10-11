from uuid import UUID

from fastapi.testclient import TestClient

from backend.main import create_app


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
