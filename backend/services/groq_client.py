"""Groq adapter that permits only schema-validated model responses."""

from __future__ import annotations

from typing import TypeVar

from groq import AsyncGroq
from pydantic import BaseModel


SchemaT = TypeVar("SchemaT", bound=BaseModel)


class ServiceConfigurationError(RuntimeError):
    """Raised when a required external service has not been configured."""


class GroqClient:
    """Use a forced function call; never interpret free-form text as state."""

    def __init__(self, api_key: str | None, model: str) -> None:
        self._api_key = api_key
        self._model = model
        self._client = AsyncGroq(api_key=api_key) if api_key else None

    async def structured_completion(
        self,
        *,
        system_prompt: str,
        messages: list[dict[str, str]],
        schema: type[SchemaT],
    ) -> SchemaT:
        if self._client is None:
            raise ServiceConfigurationError("GROQ_API_KEY is required for this operation.")

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "system", "content": system_prompt}, *messages],
            temperature=0,
            tools=[
                {
                    "type": "function",
                    "function": {
                        "name": "return_structured_response",
                        "description": "Return the response matching the required schema.",
                        "parameters": schema.model_json_schema(),
                    },
                }
            ],
            tool_choice={"type": "function", "function": {"name": "return_structured_response"}},
            parallel_tool_calls=False,
        )
        calls = response.choices[0].message.tool_calls
        if not calls:
            raise RuntimeError("Groq returned an empty structured response.")
        return schema.model_validate_json(calls[0].function.arguments)
