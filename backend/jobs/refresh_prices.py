"""Refresh tracked product prices. Run from a trusted scheduler."""

from __future__ import annotations

import asyncio
import json

from backend.config import get_settings
from backend.services.db import Database
from backend.services.firecrawl_client import FirecrawlClient
from backend.services.groq_client import ServiceConfigurationError


async def refresh_prices(database: Database, scraper: FirecrawlClient) -> dict[str, int]:
    products = await database.get_tracked_products()
    checked = changed = failed = 0
    for product in products:
        checked += 1
        try:
            refreshed = await scraper.refresh_product(product["source_url"])
            if refreshed and await database.record_tracked_price(product["id"], refreshed.price):
                changed += 1
        except Exception:
            # One blocked retailer page must not prevent the remaining tracked products.
            failed += 1
    return {"checked": checked, "changed": changed, "failed": failed}


async def main() -> None:
    settings = get_settings()
    if not settings.database_url:
        raise ServiceConfigurationError("DATABASE_URL is required to refresh tracked prices.")
    database = Database(settings.database_url)
    await database.connect()
    try:
        result = await refresh_prices(database, FirecrawlClient(settings.firecrawl_api_key))
        print(json.dumps(result))
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
