"""Certificate lifecycle tests."""
import pytest


@pytest.mark.asyncio
async def test_certificate_list(client, auth_headers):
    resp = await client.get("/api/v1/certificates/", headers=auth_headers)
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_certificate_registry_public(client):
    """Registry should be publicly accessible without auth."""
    resp = await client.get("/api/v1/registry")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, (list, dict))
