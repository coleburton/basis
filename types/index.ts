// Core domain types

export type Grain = 'month' | 'quarter' | 'year' | 'day';

export interface Org {
  id: string;
  name: string;
  created_at: string;
  snowflake_schema: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  org_id: string;
  role: 'creator' | 'composer' | 'viewer';
  created_at: string;
}

export interface Workbook {
  id: string;
  name: string;
  org_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Sheet {
  id: string;
  workbook_id: string;
  name: string;
  order: number;
  created_at: string;
  updated_at: string;
}

export interface Scenario {
  id: string;
  workbook_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

export interface CellOverride {
  id: string;
  scenario_id: string;
  sheet_id: string;
  cell_address: string; // e.g., "A1"
  value: string | number | null;
  created_at: string;
}

export interface Model {
  id: string;
  org_id: string;
  database: string;
  schema: string;
  name: string;
  model_type: 'table' | 'view';
  sql_definition: string | null;
  created_by: string | null;
  created_at: string;
  refreshed_at: string | null;
}

export interface MetricDefinition {
  name: string;
  description: string;
  source_table: string; // Format: database.schema.table
  date_column: string;
  value_column: string;
  dimension_columns?: string[];
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

export interface MetricCacheEntry {
  id: string;
  org_id: string;
  metric_name: string;
  grain: Grain;
  start_date: string;
  end_date: string;
  dimensions: Record<string, string> | null;
  value: number;
  cached_at: string;
}

export interface SqlJob {
  id: string;
  org_id: string;
  user_id: string;
  sql: string;
  status: 'pending' | 'running' | 'success' | 'error';
  error_message: string | null;
  rows_affected: number | null;
  execution_time_ms: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface AuditLog {
  id: string;
  org_id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// API request/response types

export interface MetricRequest {
  name: string;
  start: string; // ISO date
  end: string;   // ISO date
  grain: Grain;
  dimensions?: Record<string, string>;
  fill?: 'zero' | 'null' | 'forward';
  fiscal?: boolean;
}

export interface MetricResponse {
  metric: string;
  grain: Grain;
  data: Array<{
    period: string;
    value: number;
    dimensions?: Record<string, string>;
  }>;
  cached: boolean;
  query_time_ms: number;
}

export interface SqlPreviewRequest {
  sql: string;
}

export interface SqlPreviewResponse {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  total_rows: number;
  limited: boolean;
}

export interface SqlRunRequest {
  sql: string;
  model_name?: string;
}

export interface SqlRunResponse {
  job_id: string;
  status: string;
}

export interface ModelCatalogEntry {
  database: string;
  schema: string;
  name: string;
  type: 'table' | 'view';
  columns: Array<{
    name: string;
    type: string;
  }>;
  row_count?: number;
}

// Grid/UI types

export interface CellData {
  value: string | number | null;
  formula?: string;
  format?: CellFormat;
  isOverride?: boolean;
}

export interface CellFormat {
  type: 'text' | 'number' | 'currency' | 'percent' | 'date';
  decimals?: number;
  currencySymbol?: string;
}

export interface GridHeader {
  label: string;
  date?: Date;
  grain?: Grain;
}

export interface SheetState {
  cells: Record<string, CellData>; // keyed by cell address like "A1"
  headers: {
    rows: GridHeader[];
    cols: GridHeader[];
  };
  selectedCell: string | null;
  currentScenario: string;
}
