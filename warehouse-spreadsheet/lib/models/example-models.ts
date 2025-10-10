/**
 * Example Model Definitions
 * 
 * These are SQL-based model definitions that can be materialized
 * and queried across multiple workbooks.
 * 
 * Each model should:
 * - Return data at the finest grain (daily with dimensions)
 * - Include a date column (date_value, created_dt, etc.)
 * - Include dimension columns (channel, region, product, etc.)
 * - Include measure columns (new_users, revenue, orders, etc.)
 */

export const EXAMPLE_MODELS = {
  // Example: New users model at daily grain with channel dimension
  new_users: {
    name: 'new_users',
    description: 'New user signups by day and channel',
    sql: `
SELECT 
  DATE(created_at) as created_dt,
  channel,
  region,
  COUNT(DISTINCT user_id) as new_users,
  SUM(initial_value) as signup_revenue
FROM raw.users
WHERE created_at >= '2024-01-01'
GROUP BY DATE(created_at), channel, region
ORDER BY created_dt
    `.trim(),
    primary_date_column: 'created_dt',
    date_grain: 'day' as const,
    dimension_columns: ['channel', 'region'],
    measure_columns: ['new_users', 'signup_revenue'],
  },

  // Example: Revenue model at daily grain with multiple dimensions
  revenue: {
    name: 'revenue',
    description: 'Revenue by day, product, and region',
    sql: `
SELECT 
  DATE(order_date) as order_dt,
  product,
  region,
  status,
  COUNT(DISTINCT order_id) as orders,
  SUM(amount) as revenue,
  AVG(amount) as avg_order_value
FROM raw.orders
WHERE order_date >= '2024-01-01'
  AND status = 'completed'
GROUP BY DATE(order_date), product, region, status
ORDER BY order_dt
    `.trim(),
    primary_date_column: 'order_dt',
    date_grain: 'day' as const,
    dimension_columns: ['product', 'region', 'status'],
    measure_columns: ['orders', 'revenue', 'avg_order_value'],
  },

  // Example: Marketing spend model
  marketing_spend: {
    name: 'marketing_spend',
    description: 'Marketing spend by day and channel',
    sql: `
SELECT 
  DATE(spend_date) as spend_dt,
  channel,
  campaign_type,
  SUM(amount) as spend,
  SUM(impressions) as impressions,
  SUM(clicks) as clicks
FROM raw.marketing_spend
WHERE spend_date >= '2024-01-01'
GROUP BY DATE(spend_date), channel, campaign_type
ORDER BY spend_dt
    `.trim(),
    primary_date_column: 'spend_dt',
    date_grain: 'day' as const,
    dimension_columns: ['channel', 'campaign_type'],
    measure_columns: ['spend', 'impressions', 'clicks'],
  },
};

/**
 * Helper function to create a model in the database
 */
export async function createModelFromDefinition(
  supabase: any,
  orgId: string,
  definition: typeof EXAMPLE_MODELS.new_users
) {
  const { data, error } = await supabase
    .from('models_catalog')
    .insert({
      org_id: orgId,
      name: definition.name,
      database: 'ANALYTICS', // Default database
      schema: 'PUBLIC', // Default schema
      model_type: 'view',
      sql_definition: definition.sql,
      primary_date_column: definition.primary_date_column,
      date_grain: definition.date_grain,
      dimension_columns: definition.dimension_columns,
      measure_columns: definition.measure_columns,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create model: ${error.message}`);
  }

  return data.id;
}

/**
 * Helper function to create metrics for a model
 */
export async function createMetricsForModel(
  supabase: any,
  orgId: string,
  modelId: string,
  metrics: Array<{
    name: string;
    display_name: string;
    description: string;
    measure_column: string;
    aggregation: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max';
    format_type?: 'number' | 'currency' | 'percent';
    currency_code?: string;
  }>
) {
  const { data, error } = await supabase
    .from('metrics')
    .insert(
      metrics.map(metric => ({
        org_id: orgId,
        model_id: modelId,
        name: metric.name,
        display_name: metric.display_name,
        description: metric.description,
        measure_column: metric.measure_column,
        aggregation: metric.aggregation,
        format_type: metric.format_type,
        currency_code: metric.currency_code,
      }))
    );

  if (error) {
    throw new Error(`Failed to create metrics: ${error.message}`);
  }

  return data;
}

