"""Authentication critical path tests."""
import pytest
import uuid


@pytest.mark.asyncio
async def test_register_and_login(client):
    email = f"test_{uuid.uuid4().hex[:8]}@test.example.com"
    # Register
    resp = await client.post("/api/v1/auth/register", json={
        "email": email,
        "password": "SecurePass123!",
        "full_name": "Auth Test",
        "organization": "Test Corp"
    })
    assert resp.status_code in (200, 201), f"Register failed: {resp.text}"
    
    # Login
    resp = await client.post("/api/v1/auth/login", json={
        "email": email,
        "password": "SecurePass123!"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert len(data["access_token"]) > 20


@pytest.mark.asyncio
async def test_invalid_login(client):
    resp = await client.post("/api/v1/auth/login", json={
        "email": "nonexistent@test.example.com",
        "password": "WrongPass123!"
    })
    assert resp.status_code in (401, 400, 422)


@pytest.mark.asyncio
async def test_protected_route_without_token(client):
    resp = await client.get("/api/dashboard")
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_protected_route_with_bad_token(client):
    resp = await client.get("/api/dashboard", headers={
        "Authorization": "Bearer invalid.token.here"
    })
    assert resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_protected_route_with_valid_token(client, auth_headers):
    resp = await client.get("/api/dashboard", headers=auth_headers)
    assert resp.status_code == 200
