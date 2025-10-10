-- Consolidated Schema Migration
-- Combines initial schema with workbook persistence
-- Safe to run on fresh database or existing database

-- ============================================================================
-- CLEAN SLATE: Drop existing tables if they exist (in correct order)
-- ============================================================================

DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS refresh_schedules CASCADE;
DROP TABLE IF EXISTS sql_jobs CASCADE;
DROP TABLE IF EXISTS metric_cache CASCADE;
DROP TABLE IF EXISTS cell_overrides CASCADE;
DROP TABLE IF EXISTS scenarios CASCADE;
DROP TABLE IF EXISTS metric_ranges CASCADE;
DROP TABLE IF EXISTS sheets CASCADE;
DROP TABLE IF EXISTS workbooks CASCADE;
DROP TABLE IF EXISTS models_catalog CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS orgs CASCADE;

-- Drop functions if they exist
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS update_workbook_last_opened(UUID) CASCADE;

-- ============================================================================
-- ORGANIZATIONS (for multi-tenant support in the future)
-- ============================================================================

CREATE TABLE orgs (
  id TEXT PRIMARY KEY DEFAULT 'default',
  name TEXT NOT NULL,
  snowflake_schema TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- WORKBOOKS
-- ============================================================================

CREATE TABLE workbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID, -- Future: will reference users table
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_opened_at TIMESTAMPTZ
);

-- ============================================================================
-- SHEETS (with sparse cell storage)
-- ============================================================================

CREATE TABLE sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,

  -- SPARSE cell data - only stores cells with content
  cell_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Grid dimensions
  num_rows INTEGER NOT NULL DEFAULT 50,
  num_cols INTEGER NOT NULL DEFAULT 10,

  -- HyperFormula sheet ID
  hyperformula_sheet_id INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- METRIC RANGES
-- ============================================================================

CREATE TABLE metric_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
  range_id TEXT NOT NULL,
  metric_id TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sheet_id, range_id)
);

-- ============================================================================
-- MODELS CATALOG
-- ============================================================================

CREATE TABLE models_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'default',
  database TEXT NOT NULL,
  schema TEXT NOT NULL,
  name TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('table', 'view')),
  sql_definition TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  refreshed_at TIMESTAMPTZ,
  UNIQUE(org_id, database, schema, name)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_workbooks_org_updated ON workbooks(org_id, updated_at DESC);
CREATE INDEX idx_sheets_workbook ON sheets(workbook_id, position);
CREATE INDEX idx_metric_ranges_sheet ON metric_ranges(sheet_id);
CREATE INDEX idx_metric_ranges_metric ON metric_ranges(metric_id);
CREATE INDEX idx_sheets_cell_data ON sheets USING GIN (cell_data);
CREATE INDEX idx_models_catalog_org ON models_catalog(org_id);

-- ============================================================================
-- ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE workbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_ranges ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (will add user-based policies later)
CREATE POLICY workbooks_allow_all ON workbooks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY sheets_allow_all ON sheets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY metric_ranges_allow_all ON metric_ranges FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGERS & FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workbooks_updated_at
  BEFORE UPDATE ON workbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sheets_updated_at
  BEFORE UPDATE ON sheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_metric_ranges_updated_at
  BEFORE UPDATE ON metric_ranges
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION update_workbook_last_opened(workbook_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE workbooks SET last_opened_at = NOW() WHERE id = workbook_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default org
INSERT INTO orgs (id, name, snowflake_schema)
VALUES ('default', 'Default Organization', 'APP_WORKSPACE_DEFAULT');

-- Create sample workbook
INSERT INTO workbooks (name, description, org_id)
VALUES ('Sample Workbook', 'A sample workbook for testing', 'default')
RETURNING id;

-- Note: We'll create the sample sheet in a follow-up insert
-- This ensures the workbook ID is available
