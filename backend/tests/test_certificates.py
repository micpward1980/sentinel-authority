"""Certificate lifecycle tests."""
import pytest


@pytest.mark.asyncio
async def test_certificate_list_requires_auth(client, auth_headers):
    """Certificate list requires auth (200 or 403 for non-admin)."""
    resp = await client.get("/api/v1/certificates/", headers=auth_headers)
    assert resp.status_code in (200, 403)


@pytest.mark.asyncio
async def test_certificate_list_no_auth(client):
    """Certificate list without auth should return 401."""
    resp = await client.get("/api/v1/certificates/")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_certificate_registry_public(client):
    """Registry should be publicly accessible without auth."""
    resp = await client.get("/api/v1/registry/")
    assert resp.status_code in (200, 307)
