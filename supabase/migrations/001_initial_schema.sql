-- Initial schema for warehouse-native spreadsheet app

-- Organizations table
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  snowflake_schema TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('creator', 'composer', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Workbooks table
CREATE TABLE workbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sheets table
CREATE TABLE sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scenarios table
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workbook_id UUID NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cell overrides table (for scenario-specific values)
CREATE TABLE cell_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  sheet_id UUID NOT NULL REFERENCES sheets(id) ON DELETE CASCADE,
  cell_address TEXT NOT NULL, -- e.g., "A1", "B5"
  value TEXT, -- Stored as text, parsed by client
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(scenario_id, sheet_id, cell_address)
);

-- Models catalog (tracks Snowflake tables/views)
CREATE TABLE models_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  database TEXT NOT NULL,
  schema TEXT NOT NULL,
  name TEXT NOT NULL,
  model_type TEXT NOT NULL CHECK (model_type IN ('table', 'view')),
  sql_definition TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  refreshed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(org_id, database, schema, name)
);

-- Metric cache table
CREATE TABLE metric_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  grain TEXT NOT NULL CHECK (grain IN ('day', 'month', 'quarter', 'year')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  dimensions JSONB,
  value NUMERIC NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Create a unique constraint to prevent duplicate cache entries
  UNIQUE(org_id, metric_name, grain, start_date, end_date, dimensions)
);

-- SQL jobs table
CREATE TABLE sql_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  sql TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'error')),
  error_message TEXT,
  rows_affected INTEGER,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Refresh schedules table
CREATE TABLE refresh_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_users_org_id ON users(org_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_workbooks_org_id ON workbooks(org_id);
CREATE INDEX idx_workbooks_created_by ON workbooks(created_by);
CREATE INDEX idx_sheets_workbook_id ON sheets(workbook_id);
CREATE INDEX idx_scenarios_workbook_id ON scenarios(workbook_id);
CREATE INDEX idx_cell_overrides_scenario_id ON cell_overrides(scenario_id);
CREATE INDEX idx_cell_overrides_sheet_id ON cell_overrides(sheet_id);
CREATE INDEX idx_models_catalog_org_id ON models_catalog(org_id);
CREATE INDEX idx_metric_cache_lookup ON metric_cache(org_id, metric_name, grain, start_date, end_date);
CREATE INDEX idx_sql_jobs_org_id ON sql_jobs(org_id);
CREATE INDEX idx_sql_jobs_user_id ON sql_jobs(user_id);
CREATE INDEX idx_sql_jobs_status ON sql_jobs(status);
CREATE INDEX idx_audit_log_org_id ON audit_log(org_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_workbooks_updated_at
  BEFORE UPDATE ON workbooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sheets_updated_at
  BEFORE UPDATE ON sheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert default org for development
INSERT INTO orgs (id, name, snowflake_schema)
VALUES (
  'default_org',
  'Default Organization',
  'APP_WORKSPACE_DEFAULT'
);

-- Insert default user for development
INSERT INTO users (id, email, name, org_id, role)
VALUES (
  gen_random_uuid(),
  'dev@example.com',
  'Developer',
  'default_org',
  'creator'
);
