"""Add email_preferences column to users table"""
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE users ADD COLUMN IF NOT EXISTS email_preferences JSON
            DEFAULT '{"application_updates":true,"test_notifications":true,"certificate_alerts":true,"agent_alerts":true,"marketing":false}'
        """))
        print("✓ email_preferences column added")

if __name__ == "__main__":
    asyncio.run(migrate())
