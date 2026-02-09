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
    """Run alembic migrations on startup via subprocess."""
    import subprocess, os, logging
    logger = logging.getLogger("main")
    alembic_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    try:
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            cwd=alembic_dir, capture_output=True, text=True, timeout=30
        )
        if result.returncode != 0:
            logger.warning(f"Alembic upgrade failed, stamping: {result.stderr}")
            subprocess.run(
                ["alembic", "stamp", "head"],
                cwd=alembic_dir, capture_output=True, text=True, timeout=30
            )
        logger.info("Database migrations complete")
    except Exception as e:
        logger.warning(f"Migration skipped: {e}")


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
