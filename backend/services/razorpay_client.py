"""Razorpay test-mode payment link adapter.

The browser never receives Razorpay secrets and price totals always come from
the cached product record, not a client-provided amount.
"""

from __future__ import annotations

from uuid import uuid4

import httpx

from .groq_client import ServiceConfigurationError


class RazorpayClient:
    def __init__(self, key_id: str | None, key_secret: str | None) -> None:
        self._key_id = key_id
        self._key_secret = key_secret

    async def create_payment_link(self, *, product_id: str, title: str, price_inr: int) -> str:
        if not self._key_id or not self._key_secret:
            raise ServiceConfigurationError(
                "Razorpay is not configured. Add test-mode RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env."
            )
        if price_inr <= 0:
            raise ValueError("A product must have a positive INR price before checkout.")
        reference_id = f"pw-{product_id[:8]}-{uuid4().hex[:10]}"
        payload = {
            "amount": price_inr * 100,
            "currency": "INR",
            "accept_partial": False,
            "reference_id": reference_id,
            "description": f"Pricewise demo payment: {title}"[:2048],
            "reminder_enable": False,
            "notes": {"product_id": product_id, "source": "pricewise_demo"},
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                "https://api.razorpay.com/v1/payment_links",
                auth=(self._key_id, self._key_secret),
                json=payload,
            )
        if response.is_error:
            raise RuntimeError(f"Razorpay rejected the test payment link ({response.status_code}).")
        link = response.json().get("short_url")
        if not isinstance(link, str) or not link.startswith("https://"):
            raise RuntimeError("Razorpay did not return a usable payment link.")
        return link
