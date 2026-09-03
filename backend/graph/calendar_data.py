"""Static Indian retail sale windows; intentionally no LLM or network call."""

from datetime import date

from backend.graph.state import SaleEvent


SALE_CALENDAR = [
    {"name": "Republic Day Sale", "month": 1, "day_start": 20, "day_end": 28},
    {"name": "Independence Day Sale", "month": 8, "day_start": 5, "day_end": 15},
    {"name": "Big Billion Days / Great Indian Festival", "month": 10, "day_start": 1, "day_end": 31},
    {"name": "End of Season Sale", "month": 6, "day_start": 1, "day_end": 15},
]
LOOKAHEAD_DAYS = 20


def next_sale_event(today: date) -> SaleEvent | None:
    candidates: list[tuple[date, dict]] = []
    for event in SALE_CALENDAR:
        start = date(today.year, event["month"], event["day_start"])
        if start < today:
            start = date(today.year + 1, event["month"], event["day_start"])
        candidates.append((start, event))
    start, event = min(candidates, key=lambda candidate: candidate[0])
    days = (start - today).days
    if days > LOOKAHEAD_DAYS:
        return None
    return SaleEvent(
        name=event["name"],
        starts_in_days=days,
        window_start_month=event["month"],
        window_end_month=event["month"],
    )
