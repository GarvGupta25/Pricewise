from fastapi.testclient import TestClient

from backend.main import create_app
from backend.services.groq_client import ServiceConfigurationError


def test_chat_socket_reports_configuration_error(monkeypatch) -> None:
    async def missing_configuration(*_args, **_kwargs):
        raise ServiceConfigurationError("DATABASE_URL is required before starting a shopping session.")

    monkeypatch.setattr("backend.routers.chat._get_graph", missing_configuration)
    with TestClient(create_app()) as client, client.websocket_connect("/ws/chat") as socket:
        socket.send_json(
            {"type": "user_message", "session_id": "test-session", "content": "a monitor"}
        )
        response = socket.receive_json()

    assert response["type"] == "error"
    assert response["code"] == "CONFIGURATION_ERROR"


def test_chat_socket_does_not_expose_internal_errors(monkeypatch) -> None:
    async def broken_graph(*_args, **_kwargs):
        raise RuntimeError("secret database detail")

    monkeypatch.setattr("backend.routers.chat._get_graph", broken_graph)
    with TestClient(create_app()) as client, client.websocket_connect("/ws/chat") as socket:
        socket.send_json(
            {"type": "user_message", "session_id": "test-session", "content": "a monitor"}
        )
        response = socket.receive_json()

    assert response == {
        "type": "error",
        "message": "Live search could not finish. Please try again.",
        "code": "PROCESSING_ERROR",
    }


def test_payment_link_rejects_non_uuid_product_id() -> None:
    with TestClient(create_app()) as client:
        response = client.post("/payment-link", json={"product_id": "not-a-product-id"})

    assert response.status_code == 422
