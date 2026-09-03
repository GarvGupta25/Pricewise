"""Construct the stateful, interruptible LangGraph shopping workflow."""

from __future__ import annotations

from dataclasses import dataclass

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.types import interrupt

from backend.graph.nodes.conversational_feedback import conversational_feedback_node
from backend.graph.nodes.final_decision import final_decision_node
from backend.graph.nodes.historical_price_tracker import historical_price_tracker_node
from backend.graph.nodes.holiday_trend import holiday_trend_node
from backend.graph.nodes.hybrid_search import hybrid_search_node
from backend.graph.nodes.intent_extractor import intent_extractor_node
from backend.graph.nodes.top_k_aggregator import top_k_aggregator_node
from backend.graph.routing import router_specific_enough
from backend.graph.state import GraphState


@dataclass
class GraphDependencies:
    llm: object
    database: object
    embeddings: object
    scraper: object


def build_graph(dependencies: GraphDependencies):
    graph = StateGraph(GraphState)

    async def extract(state: GraphState) -> dict:
        return await intent_extractor_node(state, dependencies.llm)

    async def ask_and_pause(state: GraphState) -> dict:
        question_update = await conversational_feedback_node(state, dependencies.llm)
        reply = interrupt(
            {"type": "clarification_needed", "question": question_update["final_response"]}
        )
        content = reply.get("content", "") if isinstance(reply, dict) else str(reply)
        if not content.strip():
            raise ValueError("A clarification response must contain text.")
        history = [
            *state["conversation_history"],
            {"role": "user", "content": state["user_query"]},
            {"role": "assistant", "content": question_update["final_response"]},
        ]
        return {**question_update, "user_query": content, "conversation_history": history}

    async def search(state: GraphState) -> dict:
        return await hybrid_search_node(
            state, dependencies.database, dependencies.embeddings, dependencies.scraper
        )

    async def aggregate(state: GraphState) -> dict:
        return await top_k_aggregator_node(state)

    async def track(state: GraphState) -> dict:
        return await historical_price_tracker_node(state, dependencies.database)

    async def calendar(state: GraphState) -> dict:
        return await holiday_trend_node(state)

    async def decide_and_phrase(state: GraphState) -> dict:
        return await final_decision_node(state, dependencies.llm)

    graph.add_node("intent_extractor", extract)
    graph.add_node("conversational_feedback", ask_and_pause)
    graph.add_node("hybrid_search", search)
    graph.add_node("top_k_aggregator", aggregate)
    graph.add_node("historical_price_tracker", track)
    graph.add_node("holiday_trend", calendar)
    graph.add_node("final_decision", decide_and_phrase)
    graph.set_entry_point("intent_extractor")
    graph.add_conditional_edges(
        "intent_extractor",
        router_specific_enough,
        {"hybrid_search": "hybrid_search", "conversational_feedback": "conversational_feedback"},
    )
    graph.add_edge("conversational_feedback", "intent_extractor")
    graph.add_edge("hybrid_search", "top_k_aggregator")
    graph.add_edge("top_k_aggregator", "historical_price_tracker")
    graph.add_edge("historical_price_tracker", "holiday_trend")
    graph.add_edge("holiday_trend", "final_decision")
    graph.add_edge("final_decision", END)
    return graph.compile(checkpointer=MemorySaver())
