"""Database configuration."""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from sqlalchemy.exc import NotSupportedError
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(
    DATABASE_URL, 
    echo=settings.DEBUG, 
    future=True,
    poolclass=NullPool, connect_args={"statement_cache_size": 0},
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


class RetrySession(AsyncSession):
    async def execute(self, statement, *args, **kwargs):
        try:
            return await super().execute(statement, *args, **kwargs)
        except NotSupportedError:
            await self.rollback()
            return await super().execute(statement, *args, **kwargs)


RetrySessionLocal = async_sessionmaker(engine, class_=RetrySession, expire_on_commit=False)


async def get_db():
    async with RetrySessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
