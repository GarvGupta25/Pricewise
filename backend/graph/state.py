"""The single state contract carried through every LangGraph node."""

from __future__ import annotations

from typing import Literal, NotRequired, Optional, TypedDict

from pydantic import BaseModel, Field


class PricePoint(BaseModel):
    price: int = Field(ge=0, description="INR as an integer; paise are not stored")
    recorded_at: str


class ProductResult(BaseModel):
    id: str
    source_site: str
    source_url: str
    title: str
    brand: Optional[str] = None
    price: int = Field(ge=0, description="INR as an integer")
    specs: dict = Field(default_factory=dict)
    rating: Optional[float] = None
    review_count: Optional[int] = Field(default=None, ge=0)


class SaleEvent(BaseModel):
    name: str
    starts_in_days: int = Field(ge=0)
    window_start_month: int = Field(ge=1, le=12)
    window_end_month: int = Field(ge=1, le=12)


class GraphState(TypedDict):
    # Raw input
    user_query: str
    conversation_history: list[dict]

    # Extracted intent
    product_category: Optional[str]
    brand: Optional[str]
    model_sku: Optional[str]
    specs: dict
    budget_min: Optional[int]
    budget_max: Optional[int]
    urgency: Optional[Literal["immediate", "flexible", "planning"]]

    # Control flow
    intent_complete: bool
    missing_fields: list[str]
    turn_count: int

    # Search results
    search_candidates: list[dict]
    top_k_products: list[ProductResult]

    # Intelligence layer
    price_history: dict[str, list[PricePoint]]
    upcoming_sale: Optional[SaleEvent]
    recommendation: Optional[Literal["buy_now", "wait", "insufficient_data"]]

    # Output
    final_response: str
    current_stage: str


class IntentFields(TypedDict):
    """Fields the intent structured-output call is allowed to update."""

    product_category: NotRequired[str | None]
    brand: NotRequired[str | None]
    model_sku: NotRequired[str | None]
    specs: NotRequired[dict]
    budget_min: NotRequired[int | None]
    budget_max: NotRequired[int | None]
    urgency: NotRequired[Literal["immediate", "flexible", "planning"] | None]


REQUIRED_FIELDS: dict[str, list[str]] = {
    "monitor": ["size_inches", "resolution", "budget_max"],
    "laptop": ["use_case", "budget_max"],
    "headphones": ["type", "budget_max"],
    "smartphone": ["budget_max", "primary_use"],
    "default": ["budget_max"],
}


def initial_graph_state(user_query: str, conversation_history: list[dict] | None = None) -> GraphState:
    """Create an explicit complete state object for a new browser session."""
    return {
        "user_query": user_query,
        "conversation_history": conversation_history or [],
        "product_category": None,
        "brand": None,
        "model_sku": None,
        "specs": {},
        "budget_min": None,
        "budget_max": None,
        "urgency": None,
        "intent_complete": False,
        "missing_fields": [],
        "turn_count": 0,
        "search_candidates": [],
        "top_k_products": [],
        "price_history": {},
        "upcoming_sale": None,
        "recommendation": None,
        "final_response": "",
        "current_stage": "intake",
    }
