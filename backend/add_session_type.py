"""Add session_type column to envelo_sessions"""
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE envelo_sessions ADD COLUMN session_type VARCHAR(20) DEFAULT 'production'"))
            print("  ✓ Column added")
        except Exception as e:
            if 'already exists' in str(e).lower() or 'duplicate' in str(e).lower():
                print("  Column already exists")
            else:
                print(f"  Migration error: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
