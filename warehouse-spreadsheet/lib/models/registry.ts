import type { Model, MetricDefinition } from '@/types';

/**
 * Model Registry
 *
 * Phase 1 (Now): Models and metrics are defined here in code
 * Phase 2 (Future): These will be loaded from database per-org
 *
 * For your use case:
 * - Define your Snowflake "users" table as a Model
 * - Define metrics like "new_users", "active_users" based on that model
 */

// =============================================================================
// MODELS - Your Data Sources
// =============================================================================

export const MODELS_REGISTRY: Record<string, Model> = {
  users: {
    id: 'model_users',
    org_id: 'default', // Your org ID - will be dynamic in Phase 2
    name: 'users',
    description: 'User accounts and registration data',

    // Snowflake source
    database: 'ANALYTICS',
    schema: 'PUBLIC',
    table: 'USERS',
    model_type: 'table',

    // Time dimension - critical for automatic date filtering
    primary_date_column: 'created_at',
    date_column_type: 'timestamp',

    created_by: 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  revenue: {
    id: 'model_revenue',
    org_id: 'default',
    name: 'revenue',
    description: 'Revenue transactions',

    database: 'ANALYTICS',
    schema: 'PUBLIC',
    table: 'REVENUE',
    model_type: 'table',

    primary_date_column: 'transaction_date',
    date_column_type: 'date',

    created_by: 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

// =============================================================================
// METRICS - Calculated Measures from Models
// =============================================================================

export const METRICS_REGISTRY: Record<string, MetricDefinition> = {
  new_users: {
    id: 'metric_new_users',
    org_id: 'default',
    model_id: 'model_users',

    name: 'new_users',
    display_name: 'New Users',
    description: 'Count of new user registrations in the period',

    measure_column: 'user_id',
    aggregation: 'count_distinct',

    format_type: 'number',

    created_by: 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  active_users: {
    id: 'metric_active_users',
    org_id: 'default',
    model_id: 'model_users',

    name: 'active_users',
    display_name: 'Active Users',
    description: 'Count of active users (with status = active)',

    measure_column: 'user_id',
    aggregation: 'count_distinct',

    // This metric has a filter: only count users with status = 'active'
    filters: [
      {
        column: 'status',
        operator: 'eq',
        value: 'active',
      },
    ],

    format_type: 'number',

    created_by: 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },

  total_revenue: {
    id: 'metric_total_revenue',
    org_id: 'default',
    model_id: 'model_revenue',

    name: 'total_revenue',
    display_name: 'Total Revenue',
    description: 'Sum of all revenue in the period',

    measure_column: 'amount',
    aggregation: 'sum',

    format_type: 'currency',
    currency_code: 'USD',

    created_by: 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get model by name
 */
export function getModel(name: string, orgId: string = 'default'): Model | null {
  const model = MODELS_REGISTRY[name];
  if (!model || model.org_id !== orgId) {
    return null;
  }
  return model;
}

/**
 * Get metric by name
 */
export function getMetric(name: string, orgId: string = 'default'): MetricDefinition | null {
  const metric = METRICS_REGISTRY[name];
  if (!metric || metric.org_id !== orgId) {
    return null;
  }
  return metric;
}

/**
 * Get model for a metric
 */
export function getModelForMetric(metricName: string, orgId: string = 'default'): Model | null {
  const metric = getMetric(metricName, orgId);
  if (!metric) {
    return null;
  }

  // Find the model by ID
  const model = Object.values(MODELS_REGISTRY).find(
    (m) => m.id === metric.model_id && m.org_id === orgId
  );

  return model || null;
}

/**
 * List all models for an org
 */
export function listModels(orgId: string = 'default'): Model[] {
  return Object.values(MODELS_REGISTRY).filter((m) => m.org_id === orgId);
}

/**
 * List all metrics for an org
 */
export function listMetrics(orgId: string = 'default'): MetricDefinition[] {
  return Object.values(METRICS_REGISTRY).filter((m) => m.org_id === orgId);
}

/**
 * List metrics for a specific model
 */
export function listMetricsForModel(modelName: string, orgId: string = 'default'): MetricDefinition[] {
  const model = getModel(modelName, orgId);
  if (!model) {
    return [];
  }

  return Object.values(METRICS_REGISTRY).filter(
    (m) => m.model_id === model.id && m.org_id === orgId
  );
}

// =============================================================================
// DATABASE SYNC FUNCTIONS
// =============================================================================

/**
 * Sync code-defined models to Supabase database
 * This allows models defined in code to be stored in the database
 * for materialization and querying
 */
export async function syncModelsToDatabase(supabase: any, orgId: string = 'default'): Promise<void> {
  const models = listModels(orgId);

  for (const model of models) {
    // Check if model already exists
    const { data: existing } = await supabase
      .from('models_catalog')
      .select('id')
      .eq('org_id', model.org_id)
      .eq('name', model.name)
      .single();

    if (existing) {
      // Update existing model
      await supabase
        .from('models_catalog')
        .update({
          database: model.database,
          schema: model.schema,
          model_type: model.model_type,
          primary_date_column: model.primary_date_column,
        })
        .eq('id', existing.id);
    } else {
      // Insert new model
      await supabase
        .from('models_catalog')
        .insert({
          id: model.id,
          org_id: model.org_id,
          name: model.name,
          database: model.database,
          schema: model.schema,
          model_type: model.model_type,
          primary_date_column: model.primary_date_column,
        });
    }
  }
}

/**
 * Sync code-defined metrics to Supabase database
 */
export async function syncMetricsToDatabase(supabase: any, orgId: string = 'default'): Promise<void> {
  const metrics = listMetrics(orgId);

  for (const metric of metrics) {
    // Check if metric already exists
    const { data: existing } = await supabase
      .from('metrics')
      .select('id')
      .eq('org_id', metric.org_id)
      .eq('name', metric.name)
      .single();

    if (existing) {
      // Update existing metric
      await supabase
        .from('metrics')
        .update({
          model_id: metric.model_id,
          display_name: metric.display_name,
          description: metric.description,
          measure_column: metric.measure_column,
          aggregation: metric.aggregation,
          filters: metric.filters,
          format_type: metric.format_type,
          currency_code: metric.currency_code,
        })
        .eq('id', existing.id);
    } else {
      // Insert new metric
      await supabase
        .from('metrics')
        .insert({
          id: metric.id,
          org_id: metric.org_id,
          model_id: metric.model_id,
          name: metric.name,
          display_name: metric.display_name,
          description: metric.description,
          measure_column: metric.measure_column,
          aggregation: metric.aggregation,
          filters: metric.filters,
          format_type: metric.format_type,
          currency_code: metric.currency_code,
          created_by: null,
        });
    }
  }
}
