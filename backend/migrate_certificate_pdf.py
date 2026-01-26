"""Add pdf_data column to certificates table"""
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE certificates 
            ADD COLUMN IF NOT EXISTS pdf_data BYTEA
        """))
        print("Added pdf_data column")

if __name__ == "__main__":
    asyncio.run(migrate())
