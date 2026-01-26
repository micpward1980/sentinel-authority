"""
Migration script to add ENVELO tables
Run with: python migrate_envelo.py
"""

import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and "asyncpg" not in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

async def migrate():
    if not DATABASE_URL:
        print("No DATABASE_URL found, skipping migration")
        return
        
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        # API Keys table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id SERIAL PRIMARY KEY,
                key_hash VARCHAR(64) UNIQUE NOT NULL,
                key_prefix VARCHAR(12) NOT NULL,
                certificate_id INTEGER REFERENCES certificates(id),
                user_id INTEGER REFERENCES users(id) NOT NULL,
                name VARCHAR(100),
                created_at TIMESTAMP DEFAULT NOW(),
                last_used_at TIMESTAMP,
                revoked_at TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )
        """))
        print("✓ Created api_keys table")
        
        # ENVELO Sessions table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS envelo_sessions (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(64) UNIQUE NOT NULL,
                certificate_id INTEGER REFERENCES certificates(id),
                api_key_id INTEGER REFERENCES api_keys(id),
                started_at TIMESTAMP DEFAULT NOW(),
                ended_at TIMESTAMP,
                agent_version VARCHAR(20),
                status VARCHAR(20) DEFAULT 'active',
                last_telemetry_at TIMESTAMP,
                pass_count INTEGER DEFAULT 0,
                block_count INTEGER DEFAULT 0
            )
        """))
        print("✓ Created envelo_sessions table")
        
        # Telemetry Records table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS telemetry_records (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES envelo_sessions(id) NOT NULL,
                timestamp TIMESTAMP NOT NULL,
                action_id VARCHAR(50),
                action_type VARCHAR(100),
                result VARCHAR(10),
                execution_time_ms FLOAT,
                parameters TEXT,
                boundary_evaluations TEXT,
                system_state TEXT
            )
        """))
        print("✓ Created telemetry_records table")
        
        # Create index on telemetry timestamp
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp 
            ON telemetry_records(timestamp DESC)
        """))
        print("✓ Created telemetry timestamp index")
        
        # Violations table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS violations (
                id SERIAL PRIMARY KEY,
                session_id INTEGER REFERENCES envelo_sessions(id) NOT NULL,
                telemetry_id INTEGER REFERENCES telemetry_records(id),
                timestamp TIMESTAMP NOT NULL,
                boundary_name VARCHAR(100),
                violation_message TEXT,
                parameters TEXT
            )
        """))
        print("✓ Created violations table")
        
        # Create index on violations
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_violations_session 
            ON violations(session_id)
        """))
        print("✓ Created violations index")
        
    await engine.dispose()
    print("\n✅ Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
