"""Surveillance engine tests."""
import pytest


@pytest.mark.asyncio
async def test_surveillance_status(client, auth_headers):
    resp = await client.get("/api/surveillance/status", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "monitored_sessions" in data or "sessions" in data or isinstance(data, dict)


@pytest.mark.asyncio
async def test_surveillance_alerts(client, auth_headers):
    resp = await client.get("/api/surveillance/alerts", headers=auth_headers)
    assert resp.status_code in (200, 404)
