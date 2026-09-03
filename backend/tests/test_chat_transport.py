from fastapi.testclient import TestClient

from backend.main import create_app


def test_chat_socket_reports_missing_database_configuration() -> None:
    with TestClient(create_app()) as client, client.websocket_connect("/ws/chat") as socket:
        socket.send_json(
            {"type": "user_message", "session_id": "test-session", "content": "a monitor"}
        )
        response = socket.receive_json()

    assert response["type"] == "error"
    assert response["code"] == "CONFIGURATION_ERROR"
