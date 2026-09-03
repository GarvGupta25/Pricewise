"""Pure control-flow decisions for the graph."""

from .state import GraphState


def router_specific_enough(state: GraphState) -> str:
    """Stop asking once intent is complete or four human turns have been used."""
    if state["intent_complete"] or state["turn_count"] >= 4:
        return "hybrid_search"
    return "conversational_feedback"
