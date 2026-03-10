-- Sentinel Authority Database Initialization (Hardened)

BEGIN;

-- Required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Lock down default access
REVOKE ALL ON DATABASE sentinel_authority FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- Application role: least privilege only
GRANT CONNECT, TEMPORARY ON DATABASE sentinel_authority TO sentinel;
GRANT USAGE ON SCHEMA public TO sentinel;

-- Existing objects
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sentinel;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO sentinel;

-- Future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sentinel;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sentinel;

-- Seed only in non-production environments
DO $$
DECLARE
    app_environment text := COALESCE(current_setting('app.environment', true), 'production');
BEGIN
    IF app_environment IN ('development', 'dev', 'local', 'test') THEN
        INSERT INTO users (
            email,
            hashed_password,
            full_name,
            organization,
            role,
            is_active,
            created_at
        )
        VALUES (
            'admin@sentinelauthority.org',
            '$2b$12$REPLACE_WITH_SECURE_BCRYPT_HASH',
            'System Administrator',
            'Sentinel Authority',
            'admin',
            true,
            NOW()
        )
        ON CONFLICT (email) DO NOTHING;

        RAISE NOTICE 'Development seed user check completed';
    ELSE
        RAISE NOTICE 'Production mode detected; default users were not seeded';
    END IF;
END $$;

COMMIT;
