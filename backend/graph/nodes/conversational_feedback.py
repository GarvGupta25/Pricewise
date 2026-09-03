"""One-question clarification node; the graph pauses immediately afterwards."""

from pydantic import BaseModel

from backend.graph.state import GraphState


class Clarification(BaseModel):
    question: str


async def conversational_feedback_node(state: GraphState, llm: object) -> dict:
    field = state["missing_fields"][0] if state["missing_fields"] else "budget_max"
    clarification: Clarification = await llm.structured_completion(
        system_prompt=(
            "Ask exactly one short, friendly shopping clarification question. "
            f"Ask only for this missing field: {field}."
        ),
        messages=[{"role": "user", "content": state["user_query"]}],
        schema=Clarification,
    )
    return {
        "final_response": clarification.question,
        "turn_count": state["turn_count"] + 1,
        "current_stage": "clarifying",
    }
