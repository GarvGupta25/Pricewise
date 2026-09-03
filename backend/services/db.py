"""Async PostgreSQL access for cached products, prices, and graph state."""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

import asyncpg
from pydantic import BaseModel


CACHE_MAX_AGE_HOURS = 48


class Database:
    """A small repository layer; callers never interpolate values into SQL."""

    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        if self._pool is None:
            self._pool = await asyncpg.create_pool(self._database_url, min_size=1, max_size=5)

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    @property
    def pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("Database is not connected. Call connect() during application startup.")
        return self._pool

    async def find_fresh_exact_products(
        self,
        *,
        category: str | None,
        brand: str | None,
        model_sku: str | None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Return fresh deterministic cache matches, most recently scraped first."""
        query = """
            SELECT id, source_site, source_url, title, brand, category, specs,
                   current_price, rating, review_count, last_scraped_at
            FROM products
            WHERE last_scraped_at >= now() - ($1::text || ' hours')::interval
              AND ($2::text IS NULL OR lower(category) = lower($2))
              AND ($3::text IS NULL OR lower(brand) = lower($3))
              AND ($4::text IS NULL OR title ILIKE '%' || $4 || '%')
            ORDER BY last_scraped_at DESC
            LIMIT $5
        """
        async with self.pool.acquire() as connection:
            rows = await connection.fetch(
                query, str(CACHE_MAX_AGE_HOURS), category, brand, model_sku, limit
            )
        return [dict(row) for row in rows]

    async def find_fresh_vector_products(
        self, embedding: Sequence[float], *, limit: int = 10
    ) -> list[dict[str, Any]]:
        """Return fresh cache matches ordered by pgvector cosine distance."""
        vector_literal = "[" + ",".join(str(float(value)) for value in embedding) + "]"
        query = """
            SELECT id, source_site, source_url, title, brand, category, specs,
                   current_price, rating, review_count, last_scraped_at,
                   1 - (embedding <=> $1::vector) AS relevance_score
            FROM products
            WHERE embedding IS NOT NULL
              AND last_scraped_at >= now() - ($2::text || ' hours')::interval
            ORDER BY embedding <=> $1::vector
            LIMIT $3
        """
        async with self.pool.acquire() as connection:
            rows = await connection.fetch(
                query, vector_literal, str(CACHE_MAX_AGE_HOURS), limit
            )
        return [dict(row) for row in rows]

    async def upsert_product(
        self,
        *,
        source_site: str,
        source_url: str,
        title: str,
        brand: str | None,
        category: str | None,
        specs: dict[str, Any],
        current_price: int,
        rating: float | None,
        review_count: int | None,
        embedding: Sequence[float] | None = None,
    ) -> UUID:
        """Cache a scrape and append its integer-INR price to price history."""
        if current_price < 0:
            raise ValueError("current_price must be a non-negative integer number of INR")
        vector_literal = (
            "[" + ",".join(str(float(value)) for value in embedding) + "]"
            if embedding is not None
            else None
        )
        query = """
            INSERT INTO products (
                source_site, source_url, title, brand, category, specs,
                current_price, rating, review_count, embedding, last_scraped_at
            )
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::vector, now())
            ON CONFLICT (source_url) DO UPDATE SET
                source_site = EXCLUDED.source_site,
                title = EXCLUDED.title,
                brand = EXCLUDED.brand,
                category = EXCLUDED.category,
                specs = EXCLUDED.specs,
                current_price = EXCLUDED.current_price,
                rating = EXCLUDED.rating,
                review_count = EXCLUDED.review_count,
                embedding = COALESCE(EXCLUDED.embedding, products.embedding),
                last_scraped_at = now()
            RETURNING id
        """
        async with self.pool.acquire() as connection, connection.transaction():
            product_id = await connection.fetchval(
                query,
                source_site,
                source_url,
                title,
                brand,
                category,
                json.dumps(specs),
                current_price,
                rating,
                review_count,
                vector_literal,
            )
            await connection.execute(
                "INSERT INTO price_history (product_id, price) VALUES ($1, $2)",
                product_id,
                current_price,
            )
        return product_id

    async def get_price_history(self, product_id: UUID | str) -> list[dict[str, Any]]:
        query = """
            SELECT price, recorded_at
            FROM price_history
            WHERE product_id = $1::uuid
            ORDER BY recorded_at ASC
        """
        async with self.pool.acquire() as connection:
            rows = await connection.fetch(query, str(product_id))
        return [dict(row) for row in rows]

    async def get_price_stats(self, product_id: UUID | str) -> dict[str, Any] | None:
        query = """
            SELECT product_id, title, current_price, all_time_low, avg_90_day, history_points
            FROM product_price_stats
            WHERE product_id = $1::uuid
        """
        async with self.pool.acquire() as connection:
            row = await connection.fetchrow(query, str(product_id))
        return dict(row) if row else None

    async def load_conversation(self, session_id: str) -> dict[str, Any] | None:
        async with self.pool.acquire() as connection:
            state = await connection.fetchval(
                "SELECT state FROM conversations WHERE session_id = $1", session_id
            )
        return state

    async def save_conversation(self, session_id: str, state: dict[str, Any]) -> None:
        query = """
            INSERT INTO conversations (session_id, state, updated_at)
            VALUES ($1, $2::jsonb, now())
            ON CONFLICT (session_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()
        """
        async with self.pool.acquire() as connection:
            await connection.execute(query, session_id, json.dumps(state, default=_json_default))


def _json_default(value: Any) -> str:
    if isinstance(value, (UUID, datetime)):
        return str(value)
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    raise TypeError(f"Cannot serialize {type(value)!r} to JSON")
