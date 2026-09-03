"""Intent extraction uses a schema-constrained Groq response."""

from __future__ import annotations

from pydantic import BaseModel, Field

from backend.graph.state import GraphState, REQUIRED_FIELDS


class IntentExtraction(BaseModel):
    product_category: str | None = None
    brand: str | None = None
    model_sku: str | None = None
    # Groq may legitimately return null when no product specification was
    # stated. The node normalizes it to {} before merging graph state.
    specs: dict | None = None
    budget_min: int | None = None
    budget_max: int | None = None
    urgency: str | None = None


_SYSTEM_PROMPT = """Extract shopping intent from the conversation. Only return facts the shopper
explicitly stated. Never infer a brand, product category, specification, budget, or urgency.
Put category-specific attributes such as size_inches, resolution, use_case, type, or primary_use in specs."""


def _field_present(state: GraphState, field: str) -> bool:
    value = state[field] if field == "budget_max" else state["specs"].get(field)
    return value is not None and value != ""


async def intent_extractor_node(state: GraphState, llm: object) -> dict:
    """Merge explicit facts into state and calculate the ordered missing-field list."""
    messages = [*state["conversation_history"], {"role": "user", "content": state["user_query"]}]
    extracted: IntentExtraction = await llm.structured_completion(
        system_prompt=_SYSTEM_PROMPT, messages=messages, schema=IntentExtraction
    )
    updates = extracted.model_dump()
    merged_specs = {**state["specs"], **(updates.pop("specs") or {})}
    result = {key: value for key, value in updates.items() if value is not None}
    result["specs"] = merged_specs
    category = result.get("product_category", state["product_category"])
    scratch_state = {**state, **result}
    required = REQUIRED_FIELDS.get(category or "default", REQUIRED_FIELDS["default"])
    missing = [field for field in required if not _field_present(scratch_state, field)]
    result.update(
        missing_fields=missing,
        intent_complete=not missing,
        current_stage="extracting_intent",
    )
    return result
