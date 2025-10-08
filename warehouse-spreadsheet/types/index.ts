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

// =============================================================================
// SEMANTIC LAYER - Data Models & Metrics
// =============================================================================

/**
 * A Model represents a semantic definition of a data source (table/view)
 * This is similar to a semantic model in Power BI or LookML in Looker
 *
 * Phase 1 (Now): Defined in code per-org
 * Phase 2 (Future): Stored in database, user-configurable via UI
 */
export interface Model {
  id: string;
  org_id: string;
  name: string; // User-friendly name, e.g., "users", "revenue"
  description?: string;

  // Source configuration
  database: string;
  schema: string;
  table: string;
  model_type: 'table' | 'view';
  sql_definition?: string; // Optional custom SQL for views

  // Time dimension configuration
  primary_date_column: string; // e.g., "created_at", "order_date"
  date_column_type: 'date' | 'timestamp'; // For proper truncation

  // Metadata
  created_by: string;
  created_at: string;
  updated_at: string;
  refreshed_at?: string;
}

/**
 * Metrics are calculated measures from a Model
 * They define HOW to aggregate the data (sum, count, etc.)
 *
 * Example:
 * - Model: "users" table
 * - Metric: "new_users" = COUNT(user_id) WHERE created_at in period
 */
export interface MetricDefinition {
  id: string;
  org_id: string;
  model_id: string; // References the Model this metric is based on

  name: string; // e.g., "new_users", "total_revenue"
  display_name: string; // e.g., "New Users", "Total Revenue"
  description?: string;

  // Aggregation configuration
  measure_column: string; // Column to aggregate, e.g., "user_id", "amount"
  aggregation: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max';

  // Optional filters applied to this metric
  filters?: MetricFilter[];

  // Formatting hints
  format_type?: 'number' | 'currency' | 'percent';
  currency_code?: string; // e.g., "USD"

  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Filters that can be applied to a metric
 * Example: status = 'active', region = 'US'
 */
export interface MetricFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'like';
  value: string | number | boolean | Array<string | number>;
}

/**
 * WorkbookDataConnection represents the "attachment" of a Model to a Workbook
 * This is like adding a data connection in Excel Power Query
 * Multiple models can be attached to one workbook
 */
export interface WorkbookDataConnection {
  id: string;
  workbook_id: string;
  model_id: string;

  // Optional connection-level filters (applied to ALL metrics from this model in this workbook)
  // Example: year = 2024, department = 'Sales'
  global_filters?: Record<string, string | number>;

  created_at: string;
}

// Legacy type for backward compatibility
export interface MetricDefinitionLegacy {
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
  value: string | number | null; // The raw input value (may be a formula like "=SUM(A1:C10)")
  computedValue?: string | number | null; // The evaluated result if value is a formula
  formula?: string; // Deprecated: use value instead (kept for backwards compatibility)
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
