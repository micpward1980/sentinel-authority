"""Surveillance engine tests."""
import pytest


@pytest.mark.asyncio
async def test_surveillance_status(client, auth_headers):
    """Surveillance status endpoint responds."""
    resp = await client.get("/api/v1/surveillance/status", headers=auth_headers)
    assert resp.status_code < 500, f"Server error: {resp.status_code}"
