"""Groq adapter that permits only schema-validated model responses."""

from __future__ import annotations

import json
from typing import TypeVar

from groq import AsyncGroq
from pydantic import BaseModel


SchemaT = TypeVar("SchemaT", bound=BaseModel)


class ServiceConfigurationError(RuntimeError):
    """Raised when a required external service has not been configured."""


class GroqClient:
    """Make structured-output requests; never interpret free-form JSON as state."""

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
            response_format={
                "type": "json_schema",
                "json_schema": {"name": schema.__name__, "schema": schema.model_json_schema()},
            },
        )
        content = response.choices[0].message.content
        if not content:
            raise RuntimeError("Groq returned an empty structured response.")
        return schema.model_validate(json.loads(content))
