"""Test configuration and fixtures."""
import os
import pytest
import pytest_asyncio
import asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

# Use test database
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL", "postgresql://localhost/sentinel_test")
os.environ["SECRET_KEY"] = "test-secret-key-not-for-production"
os.environ["ENVIRONMENT"] = "test"

from main import app
from app.core.database import Base, get_db

TEST_DB_URL = os.environ["DATABASE_URL"]
if TEST_DB_URL.startswith("postgresql://"):
    TEST_DB_URL = TEST_DB_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

test_engine = create_async_engine(TEST_DB_URL, poolclass=NullPool, connect_args={"statement_cache_size": 0})
TestSession = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(setup_db):
    async with TestSession() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(setup_db):
    async def override_get_db():
        async with TestSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_headers(client):
    """Register a test user and return auth headers."""
    import uuid
    email = f"test_{uuid.uuid4().hex[:8]}@sentinel.test"
    await client.post("/api/auth/register", json={
        "email": email,
        "password": "TestPass123!",
        "full_name": "Test User",
        "organization": "Test Org"
    })
    resp = await client.post("/api/auth/login", json={
        "email": email,
        "password": "TestPass123!"
    })
    token = resp.json().get("access_token", "")
    return {"Authorization": f"Bearer {token}"}
