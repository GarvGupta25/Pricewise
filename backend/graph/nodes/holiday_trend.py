"""Sale-calendar signal node."""

from datetime import date

from backend.graph.calendar_data import next_sale_event
from backend.graph.state import GraphState


async def holiday_trend_node(state: GraphState, *, today: date | None = None) -> dict:
    return {
        "upcoming_sale": next_sale_event(today or date.today()),
        "current_stage": "checking_calendar",
    }
