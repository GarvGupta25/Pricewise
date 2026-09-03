import pytest

from backend.services.groq_client import ServiceConfigurationError
from backend.services.razorpay_client import RazorpayClient


@pytest.mark.asyncio
async def test_payment_link_requires_server_side_test_keys() -> None:
    client = RazorpayClient(None, None)
    with pytest.raises(ServiceConfigurationError):
        await client.create_payment_link(product_id="product", title="Laptop", price_inr=1000)
