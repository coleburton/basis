-- Semantic Layer Schema Migration
-- Adds support for model materialization and metric definitions
-- Simplified version that doesn't require orgs/users tables

-- =============================================================================
-- 1. Create models_catalog table if it doesn't exist (standalone version)
-- =============================================================================

CREATE TABLE IF NOT EXISTS models_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  database TEXT NOT NULL,
  schema TEXT NOT NULL,
  name TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('table', 'view')),
  sql_definition TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  refreshed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(org_id, database, schema, name)
);

-- Fix workbooks table if it exists (convert UUIDs to TEXT)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workbooks') THEN
    -- Change org_id to TEXT if it exists as UUID
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'workbooks' 
      AND column_name = 'org_id'
      AND data_type = 'uuid'
    ) THEN
      ALTER TABLE workbooks DROP CONSTRAINT IF EXISTS workbooks_org_id_fkey;
      ALTER TABLE workbooks ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
    END IF;

    -- Change created_by to TEXT if it exists as UUID
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'workbooks' 
      AND column_name = 'created_by'
      AND data_type = 'uuid'
    ) THEN
      ALTER TABLE workbooks DROP CONSTRAINT IF EXISTS workbooks_created_by_fkey;
      ALTER TABLE workbooks ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
    END IF;
  END IF;
END $$;

-- Add materialization fields (use DO block to handle if they already exist)
DO $$ 
BEGIN
  -- Change org_id to TEXT if it exists as UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'models_catalog' 
    AND column_name = 'org_id'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE models_catalog DROP CONSTRAINT IF EXISTS models_catalog_org_id_fkey;
    ALTER TABLE models_catalog ALTER COLUMN org_id TYPE TEXT USING org_id::TEXT;
  END IF;

  -- Change created_by to TEXT if it exists as UUID
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'models_catalog' 
    AND column_name = 'created_by'
    AND data_type = 'uuid'
  ) THEN
    ALTER TABLE models_catalog DROP CONSTRAINT IF EXISTS models_catalog_created_by_fkey;
    ALTER TABLE models_catalog ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
  END IF;

  -- Add new columns if they don't exist
  ALTER TABLE models_catalog ADD COLUMN IF NOT EXISTS primary_date_column TEXT;
  ALTER TABLE models_catalog ADD COLUMN IF NOT EXISTS date_grain TEXT;
  ALTER TABLE models_catalog ADD COLUMN IF NOT EXISTS dimension_columns TEXT[];
  ALTER TABLE models_catalog ADD COLUMN IF NOT EXISTS measure_columns TEXT[];
  ALTER TABLE models_catalog ADD COLUMN IF NOT EXISTS refresh_schedule TEXT;
  ALTER TABLE models_catalog ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMP WITH TIME ZONE;
  
  -- Add check constraint for date_grain if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'models_catalog_date_grain_check'
  ) THEN
    ALTER TABLE models_catalog ADD CONSTRAINT models_catalog_date_grain_check 
      CHECK (date_grain IN ('day', 'hour'));
  END IF;
END $$;

-- =============================================================================
-- 2. Create metrics table for metric definitions
-- =============================================================================

CREATE TABLE metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,  -- Changed to TEXT to avoid needing orgs table
  model_id UUID NOT NULL REFERENCES models_catalog(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  measure_column TEXT NOT NULL,
  aggregation TEXT NOT NULL CHECK (aggregation IN ('sum', 'avg', 'count', 'count_distinct', 'min', 'max')),
  filters JSONB,
  format_type TEXT CHECK (format_type IN ('number', 'currency', 'percent')),
  currency_code TEXT,
  created_by TEXT,  -- Changed to TEXT and removed foreign key
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(org_id, name)
);

-- =============================================================================
-- 3. Create materialized_model_data table for storing model results
-- =============================================================================

CREATE TABLE materialized_model_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES models_catalog(id) ON DELETE CASCADE,
  date_value DATE NOT NULL,
  dimensions JSONB,
  measures JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_models_catalog_org_id ON models_catalog(org_id);
CREATE INDEX IF NOT EXISTS idx_mat_model_lookup ON materialized_model_data(model_id, date_value);
CREATE INDEX IF NOT EXISTS idx_mat_model_dimensions ON materialized_model_data USING GIN(dimensions);
CREATE INDEX IF NOT EXISTS idx_metrics_org_id ON metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_metrics_model_id ON metrics(model_id);

-- =============================================================================
-- 4. Create model_refresh_jobs table for tracking refresh operations
-- =============================================================================

CREATE TABLE model_refresh_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,  -- Changed to TEXT to avoid needing orgs table
  model_id UUID NOT NULL REFERENCES models_catalog(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error')),
  rows_processed INTEGER,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_jobs_model_id ON model_refresh_jobs(model_id);
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_status ON model_refresh_jobs(status);
CREATE INDEX IF NOT EXISTS idx_refresh_jobs_created_at ON model_refresh_jobs(created_at DESC);

-- =============================================================================
-- 5. Triggers for updated_at
-- =============================================================================

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for metrics table
DROP TRIGGER IF EXISTS update_metrics_updated_at ON metrics;
CREATE TRIGGER update_metrics_updated_at
  BEFORE UPDATE ON metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 6. Helper function to clean old materialized data
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_materialized_data(
  p_model_id UUID,
  p_keep_days INTEGER DEFAULT 730
) RETURNS INTEGER AS $$
DECLARE
  rows_deleted INTEGER;
BEGIN
  DELETE FROM materialized_model_data
  WHERE model_id = p_model_id
    AND date_value < CURRENT_DATE - p_keep_days;
  
  GET DIAGNOSTICS rows_deleted = ROW_COUNT;
  RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql;

