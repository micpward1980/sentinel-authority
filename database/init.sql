-- Sentinel Authority Database Initialization
-- This script runs on first database creation

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE sentinel_authority TO sentinel;

-- Insert default admin user (password: admin123 - CHANGE IN PRODUCTION)
-- Password hash for 'admin123' using bcrypt
INSERT INTO users (email, hashed_password, full_name, organization, role, is_active, created_at)
VALUES (
    'admin@sentinelauthority.org',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.HQZC1nK5KjKjKi',
    'System Administrator',
    'Sentinel Authority',
    'admin',
    true,
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Insert demo operator (password: operator123 - CHANGE IN PRODUCTION)
INSERT INTO users (email, hashed_password, full_name, organization, role, is_active, created_at)
VALUES (
    'operator@sentinelauthority.org',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.HQZC1nK5KjKjKi',
    'Test Operator',
    'Sentinel Authority',
    'operator',
    true,
    NOW()
) ON CONFLICT (email) DO NOTHING;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'Sentinel Authority database initialized successfully';
END $$;
