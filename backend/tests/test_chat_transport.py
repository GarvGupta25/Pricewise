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
