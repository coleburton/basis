import type { MetricDefinition } from '@/types';

/**
 * Metric registry
 * In v1, metrics are defined in code here
 * In future versions, this could be loaded from database or config
 */
export const METRICS_REGISTRY: Record<string, MetricDefinition> = {
  families_acquired: {
    name: 'families_acquired',
    description: 'Number of families acquired in a period',
    source_table: 'ANALYTICS.FAMILIES_ACQUIRED_MONTHLY',
    date_column: 'period_month',
    value_column: 'families',
    dimension_columns: ['channel'],
    aggregation: 'sum',
  },
  revenue: {
    name: 'revenue',
    description: 'Total revenue in a period',
    source_table: 'ANALYTICS.REVENUE_MONTHLY',
    date_column: 'period_month',
    value_column: 'amount',
    dimension_columns: ['product', 'region'],
    aggregation: 'sum',
  },
  active_users: {
    name: 'active_users',
    description: 'Number of active users in a period',
    source_table: 'ANALYTICS.USER_ACTIVITY_DAILY',
    date_column: 'activity_date',
    value_column: 'user_count',
    dimension_columns: ['platform'],
    aggregation: 'sum',
  },
};

/**
 * Get metric definition by name
 */
export function getMetricDefinition(name: string): MetricDefinition | null {
  return METRICS_REGISTRY[name] || null;
}

/**
 * List all available metrics
 */
export function listMetrics(): MetricDefinition[] {
  return Object.values(METRICS_REGISTRY);
}

/**
 * Validate metric name
 */
export function isValidMetric(name: string): boolean {
  return name in METRICS_REGISTRY;
}
