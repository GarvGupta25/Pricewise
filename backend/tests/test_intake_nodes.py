import pytest

from backend.graph.nodes.conversational_feedback import conversational_feedback_node
from backend.graph.nodes.intent_extractor import IntentExtraction, intent_extractor_node
from backend.graph.state import initial_graph_state


class FakeLlm:
    def __init__(self, response: object) -> None:
        self.response = response

    async def structured_completion(self, **_: object) -> object:
        return self.response


@pytest.mark.asyncio
async def test_intent_node_only_marks_required_missing_fields() -> None:
    state = initial_graph_state("I need a monitor")
    result = await intent_extractor_node(
        state, FakeLlm(IntentExtraction(product_category="monitor"))
    )

    assert result["missing_fields"] == ["size_inches", "resolution", "budget_max"]
    assert result["intent_complete"] is False


@pytest.mark.asyncio
async def test_clarification_asks_once_and_increments_turn_count() -> None:
    state = initial_graph_state("I need a monitor")
    state["missing_fields"] = ["size_inches"]
    result = await conversational_feedback_node(
        state, FakeLlm(type("Reply", (), {"question": "What screen size do you need?"})())
    )

    assert result == {
        "final_response": "What screen size do you need?",
        "turn_count": 1,
        "current_stage": "clarifying",
    }
