"""WebSocket transport for graph progress, pause/resume, and final evidence."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from langgraph.types import Command
from pydantic import BaseModel, Field, ValidationError

from backend.config import get_settings
from backend.graph.graph_builder import GraphDependencies, build_graph
from backend.graph.state import initial_graph_state
from backend.services.db import Database
from backend.services.firecrawl_client import FirecrawlClient
from backend.services.groq_client import GroqClient, ServiceConfigurationError
from backend.services.ollama_embeddings import OllamaEmbeddings


router = APIRouter(tags=["chat"])
logger = logging.getLogger(__name__)

STAGE_LABELS = {
    "searching": "Searching approved Indian retailers...",
    "comparing": "Comparing top matches...",
    "checking_prices": "Checking price history...",
    "checking_calendar": "Checking upcoming sales...",
    "done": "Recommendation ready.",
}


class UserMessage(BaseModel):
    type: str
    session_id: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=2_000)


async def _get_graph(app: Any):
    graph = getattr(app.state, "shopping_graph", None)
    if graph is not None:
        return graph
    settings = get_settings()
    if not settings.database_url:
        raise ServiceConfigurationError("DATABASE_URL is required before starting a shopping session.")
    database = Database(settings.database_url)
    await database.connect()
    dependencies = GraphDependencies(
        llm=GroqClient(settings.groq_api_key, settings.groq_model),
        database=database,
        embeddings=OllamaEmbeddings(settings.ollama_base_url),
        scraper=FirecrawlClient(settings.firecrawl_api_key),
    )
    app.state.shopping_database = database
    app.state.shopping_graph = build_graph(dependencies)
    return app.state.shopping_graph


def _result_payload(state: dict[str, Any]) -> dict[str, Any]:
    candidates = {str(item["id"]): item for item in state["search_candidates"]}
    products = []
    for product in state["top_k_products"]:
        item = product.model_dump() if hasattr(product, "model_dump") else product
        candidate = candidates.get(str(item["id"]), {})
        history = state["price_history"].get(str(item["id"]), [])
        products.append(
            {
                "id": str(item["id"]),
                "title": item["title"],
                "source_site": item["source_site"],
                "source_url": item["source_url"],
                "current_price": item["price"],
                "all_time_low": candidate.get("all_time_low"),
                "avg_90_day": candidate.get("avg_90_day"),
                "history_points": candidate.get("history_points", len(history)),
                "rating": item.get("rating"),
                "review_count": item.get("review_count"),
                "price_history": [point.model_dump() if hasattr(point, "model_dump") else point for point in history],
                "price_data_status": candidate.get("price_data_status", "insufficient_data"),
            }
        )
    sale = state.get("upcoming_sale")
    if hasattr(sale, "model_dump"):
        sale = sale.model_dump()
    return {
        "type": "final_result",
        "recommendation": state["recommendation"],
        "reasoning": state["final_response"],
        "products": products,
        "upcoming_sale": sale,
    }


async def _persist_state(app: Any, session_id: str, state: dict[str, Any]) -> None:
    database = getattr(app.state, "shopping_database", None)
    if database is not None:
        await database.save_conversation(session_id, state)


@router.websocket("/ws/chat")
async def chat_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            try:
                message = UserMessage.model_validate(await websocket.receive_json())
                if message.type != "user_message":
                    raise ValueError("Only user_message events are accepted.")
                graph = await _get_graph(websocket.app)
                config = {"configurable": {"thread_id": message.session_id}}
                snapshot = await graph.aget_state(config)
                graph_input = (
                    Command(resume={"content": message.content})
                    if snapshot.next
                    else initial_graph_state(message.content)
                )
                async for update in graph.astream(graph_input, config=config, stream_mode="updates"):
                    if "__interrupt__" in update:
                        interrupt_value = update["__interrupt__"][0].value
                        await websocket.send_json(interrupt_value)
                        continue
                    for node_update in update.values():
                        stage = node_update.get("current_stage")
                        if stage in STAGE_LABELS:
                            await websocket.send_json(
                                {"type": "stage_update", "stage": stage, "label": STAGE_LABELS[stage]}
                            )
                final_state = (await graph.aget_state(config)).values
                await _persist_state(websocket.app, message.session_id, final_state)
                if final_state.get("current_stage") == "done":
                    await websocket.send_json(_result_payload(final_state))
            except (ValidationError, ValueError) as error:
                await websocket.send_json({"type": "error", "message": str(error), "code": "INVALID_MESSAGE"})
            except ServiceConfigurationError as error:
                await websocket.send_json({"type": "error", "message": str(error), "code": "CONFIGURATION_ERROR"})
            except Exception as error:
                logger.exception("Chat processing failed")
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": "Live search could not finish: " + str(error)[:240],
                        "code": "PROCESSING_ERROR",
                    }
                )
    except WebSocketDisconnect:
        return


@router.get("/session/{session_id}/history")
async def session_history(session_id: str, request: Request) -> dict[str, Any]:
    database = getattr(request.app.state, "shopping_database", None)
    if database is None:
        raise HTTPException(status_code=503, detail="No shopping database connection is active.")
    state = await database.load_conversation(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found.")
    return json.loads(state) if isinstance(state, str) else state
