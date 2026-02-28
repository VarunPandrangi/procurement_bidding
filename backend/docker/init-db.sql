-- Create app_user role with restricted permissions for audit_log
-- This script runs on database initialization

-- Create the app_user role if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password';
  END IF;
END
$$;

-- Grant connect on the database (only grant on databases that exist in this container)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = 'procurement_dev') THEN
    EXECUTE 'GRANT CONNECT ON DATABASE procurement_dev TO app_user';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_database WHERE datname = 'procurement_test') THEN
    EXECUTE 'GRANT CONNECT ON DATABASE procurement_test TO app_user';
  END IF;
END
$$;

-- Grant usage on public schema
GRANT USAGE ON SCHEMA public TO app_user;

-- Grant full permissions on all tables by default
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
