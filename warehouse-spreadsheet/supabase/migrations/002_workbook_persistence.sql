-- Migration: Workbook Persistence
-- Enables saving and loading workbooks with sparse cell storage
-- Created: 2025-10-09

-- ============================================================================
-- WORKBOOKS TABLE
-- ============================================================================
-- Stores workbook metadata (name, description, ownership)

CREATE TABLE IF NOT EXISTS workbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  description TEXT,

  -- Future: link to users table when auth is implemented
  created_by UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_opened_at TIMESTAMPTZ
);

-- ============================================================================
-- SHEETS TABLE
-- ============================================================================
-- Stores individual worksheet tabs within a workbook
-- Uses SPARSE storage: only non-empty cells are stored in JSONB

CREATE TABLE IF NOT EXISTS sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL, -- For tab ordering (0, 1, 2, ...)

  -- SPARSE cell data - only stores cells with content
  -- Format: { "row,col": { raw: "value", format: {...}, metricRangeId: "..." } }
  -- Example: { "0,1": { raw: "Revenue", format: { bold: true } } }
  cell_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Grid dimensions (for UI rendering)
  num_rows INTEGER NOT NULL DEFAULT 50,
  num_cols INTEGER NOT NULL DEFAULT 10,

  -- HyperFormula sheet ID (for formula engine integration)
  hyperformula_sheet_id INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- METRIC_RANGES TABLE
-- ============================================================================
-- Stores metric range configurations separately for queryability
-- These represent METRIC() formulas that span multiple cells

CREATE TABLE IF NOT EXISTS metric_ranges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,

  -- Range ID matches the ID used in sheet.metricRanges
  range_id TEXT NOT NULL,

  -- The metric being referenced (e.g., "new_users", "total_revenue")
  metric_id TEXT NOT NULL,

  -- Configuration: columns, rows, displayName, metadata
  -- Format: { columns: [1,2,3], rows: [{row: 5, formula: "..."}], ... }
  config JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure unique range_id per sheet
  UNIQUE(sheet_id, range_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- For efficient workbook listing by org
CREATE INDEX idx_workbooks_org_updated ON workbooks(org_id, updated_at DESC);

-- For fetching all sheets in a workbook
CREATE INDEX idx_sheets_workbook ON sheets(workbook_id, position);

-- For fetching metric ranges for a sheet
CREATE INDEX idx_metric_ranges_sheet ON metric_ranges(sheet_id);

-- For finding metric ranges by metric_id (useful for impact analysis)
CREATE INDEX idx_metric_ranges_metric ON metric_ranges(metric_id);

-- GIN index for efficient JSONB queries on cell_data
CREATE INDEX idx_sheets_cell_data ON sheets USING GIN (cell_data);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================
-- Enable RLS for multi-tenant support (will be enforced when auth is added)

ALTER TABLE workbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_ranges ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (will add user-based policies later)
-- When auth is implemented, these policies should check user org_id

CREATE POLICY workbooks_allow_all ON workbooks
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY sheets_allow_all ON sheets
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY metric_ranges_allow_all ON metric_ranges
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Automatically update updated_at timestamps

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

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update workbook's last_opened_at timestamp
CREATE OR REPLACE FUNCTION update_workbook_last_opened(workbook_uuid UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE workbooks
  SET last_opened_at = NOW()
  WHERE id = workbook_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (for development)
-- ============================================================================
-- Creates a sample workbook to test with

DO $$
DECLARE
  sample_workbook_id UUID;
  sample_sheet_id UUID;
BEGIN
  -- Create sample workbook
  INSERT INTO workbooks (name, description, org_id)
  VALUES ('Sample Workbook', 'A sample workbook for testing', 'default')
  RETURNING id INTO sample_workbook_id;

  -- Create sample sheet
  INSERT INTO sheets (workbook_id, name, position, cell_data)
  VALUES (
    sample_workbook_id,
    'Sheet 1',
    0,
    '{
      "0,0": {"raw": ""},
      "0,1": {"raw": "Q1 2024"},
      "0,2": {"raw": "Q2 2024"},
      "0,3": {"raw": "Q3 2024"},
      "0,4": {"raw": "Q4 2024"},
      "1,0": {"raw": "Revenue", "format": {"bold": true}},
      "1,1": {"raw": "1,250,000", "format": {"numberFormat": "currency"}},
      "1,2": {"raw": "1,380,000", "format": {"numberFormat": "currency"}},
      "1,3": {"raw": "1,520,000", "format": {"numberFormat": "currency"}},
      "1,4": {"raw": "1,680,000", "format": {"numberFormat": "currency"}}
    }'::jsonb
  )
  RETURNING id INTO sample_sheet_id;

  RAISE NOTICE 'Created sample workbook with ID: %', sample_workbook_id;
END $$;
