/**
 * MetricEvaluator
 * 
 * Evaluates metrics by querying materialized model data
 * and aggregating to the requested time grain and dimensions.
 */

import { getServerSupabaseClient } from '@/lib/supabase/client';
import type { Grain } from '@/types';

export interface MetricDefinition {
  id: string;
  org_id: string;
  model_id: string;
  name: string;
  display_name: string;
  measure_column: string;
  aggregation: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max';
  filters?: Array<{
    column: string;
    operator: string;
    value: any;
  }>;
  format_type?: 'number' | 'currency' | 'percent';
  currency_code?: string;
}

export interface EvaluationContext {
  startDate: string; // ISO date
  endDate: string;   // ISO date
  grain: Grain;
  dimensions?: Record<string, string | string[]>;
}

export interface EvaluationResult {
  value: number;
  rowsScanned: number;
}

export class MetricEvaluator {
  private supabase = getServerSupabaseClient();

  /**
   * Evaluate a metric for a specific time period
   */
  async evaluate(
    metric: MetricDefinition,
    context: EvaluationContext
  ): Promise<EvaluationResult> {
    console.log(`[MetricEvaluator] Evaluating metric: ${metric.name}`);
    console.log(`[MetricEvaluator] Model ID: ${metric.model_id}`);
    console.log(`[MetricEvaluator] Date range: ${context.startDate} to ${context.endDate}`);
    console.log(`[MetricEvaluator] Grain: ${context.grain}`);
    console.log(`[MetricEvaluator] Dimensions:`, context.dimensions);
    
    // Get materialized data for the model
    const materializedData = await this.getMaterializedData(
      metric.model_id,
      context
    );
    console.log(`[MetricEvaluator] Found ${materializedData.length} rows of materialized data`);

    if (materializedData.length === 0) {
      console.warn(`[MetricEvaluator] ⚠️ No materialized data found! Model may not be refreshed yet.`);
      return {
        value: 0,
        rowsScanned: 0,
      };
    }

    // Apply metric-level filters
    const filteredData = this.applyFilters(
      materializedData,
      metric.filters || []
    );
    console.log(`[MetricEvaluator] After metric filters: ${filteredData.length} rows`);

    // Apply dimension filters from context
    const dimensionFilteredData = this.applyDimensionFilters(
      filteredData,
      context.dimensions || {}
    );
    console.log(`[MetricEvaluator] After dimension filters: ${dimensionFilteredData.length} rows`);

    // Aggregate the measure column
    const value = this.aggregate(
      dimensionFilteredData,
      metric.measure_column,
      metric.aggregation
    );
    console.log(`[MetricEvaluator] ✅ Final aggregated value: ${value}`);

    return {
      value,
      rowsScanned: materializedData.length,
    };
  }

  /**
   * Get materialized data for a model within date range
   */
  private async getMaterializedData(
    modelId: string,
    context: EvaluationContext
  ): Promise<Array<{ date_value: string; dimensions: any; measures: any }>> {
    console.log(`[MetricEvaluator] Querying materialized_model_data...`);
    console.log(`[MetricEvaluator] Query: model_id=${modelId}, date >= ${context.startDate}, date < ${context.endDate}`);
    
    const { data, error } = await this.supabase
      .from('materialized_model_data')
      .select('date_value, dimensions, measures')
      .eq('model_id', modelId)
      .gte('date_value', context.startDate)
      .lt('date_value', context.endDate);

    if (error) {
      console.error(`[MetricEvaluator] Database error:`, error);
      throw new Error(`Failed to fetch materialized data: ${error.message}`);
    }

    if (data && data.length > 0) {
      console.log(`[MetricEvaluator] Sample row:`, data[0]);
    }

    return data || [];
  }

  /**
   * Apply metric-level filters
   */
  private applyFilters(
    data: Array<{ date_value: string; dimensions: any; measures: any }>,
    filters: Array<{ column: string; operator: string; value: any }>
  ): Array<{ date_value: string; dimensions: any; measures: any }> {
    if (filters.length === 0) return data;

    return data.filter(row => {
      return filters.every(filter => {
        // Check if column is in dimensions or measures
        const value = row.dimensions?.[filter.column] ?? row.measures?.[filter.column];
        
        if (value === undefined) return true; // Skip if column not found

        return this.evaluateFilter(value, filter.operator, filter.value);
      });
    });
  }

  /**
   * Apply dimension filters from context
   */
  private applyDimensionFilters(
    data: Array<{ date_value: string; dimensions: any; measures: any }>,
    dimensionFilters: Record<string, string | string[]>
  ): Array<{ date_value: string; dimensions: any; measures: any }> {
    if (Object.keys(dimensionFilters).length === 0) return data;

    return data.filter(row => {
      return Object.entries(dimensionFilters).every(([dimKey, dimValue]) => {
        const rowValue = row.dimensions?.[dimKey];
        
        if (rowValue === undefined) return false;

        // Handle array values (IN operator)
        if (Array.isArray(dimValue)) {
          return dimValue.includes(rowValue);
        }

        return rowValue === dimValue;
      });
    });
  }

  /**
   * Evaluate a single filter condition
   */
  private evaluateFilter(value: any, operator: string, filterValue: any): boolean {
    switch (operator) {
      case 'eq':
        return value === filterValue;
      case 'neq':
        return value !== filterValue;
      case 'gt':
        return value > filterValue;
      case 'gte':
        return value >= filterValue;
      case 'lt':
        return value < filterValue;
      case 'lte':
        return value <= filterValue;
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);
      case 'not_in':
        return Array.isArray(filterValue) && !filterValue.includes(value);
      case 'like':
        if (typeof value === 'string' && typeof filterValue === 'string') {
          const pattern = filterValue.replace(/%/g, '.*');
          return new RegExp(`^${pattern}$`, 'i').test(value);
        }
        return false;
      default:
        console.warn(`Unknown operator: ${operator}`);
        return true;
    }
  }

  /**
   * Aggregate measure values
   */
  private aggregate(
    data: Array<{ date_value: string; dimensions: any; measures: any }>,
    measureColumn: string,
    aggregation: 'sum' | 'avg' | 'count' | 'count_distinct' | 'min' | 'max'
  ): number {
    if (data.length === 0) return 0;

    // Extract measure values (case-insensitive lookup)
    const measureColumnLower = measureColumn.toLowerCase();
    const values = data
      .map(row => {
        if (!row.measures) return null;
        // Try exact match first
        if (row.measures[measureColumn] !== undefined) {
          return row.measures[measureColumn];
        }
        // Try lowercase match
        if (row.measures[measureColumnLower] !== undefined) {
          return row.measures[measureColumnLower];
        }
        // Try case-insensitive search
        const key = Object.keys(row.measures).find(k => k.toLowerCase() === measureColumnLower);
        return key ? row.measures[key] : null;
      })
      .filter(v => v !== null && v !== undefined);

    if (values.length === 0) {
      console.warn(`[MetricEvaluator] ⚠️ No valid values found for measure: ${measureColumn}`);
      return 0;
    }

    console.log(`[MetricEvaluator] Aggregating ${values.length} values using ${aggregation}`);

    switch (aggregation) {
      case 'sum':
        return values.reduce((sum, val) => sum + Number(val), 0);

      case 'avg': {
        const sum = values.reduce((sum, val) => sum + Number(val), 0);
        return sum / values.length;
      }

      case 'count':
        return values.length;

      case 'count_distinct': {
        const uniqueValues = new Set(values);
        return uniqueValues.size;
      }

      case 'min':
        return Math.min(...values.map(Number));

      case 'max':
        return Math.max(...values.map(Number));

      default:
        throw new Error(`Unknown aggregation: ${aggregation}`);
    }
  }

  /**
   * Evaluate multiple periods at once (for time series)
   */
  async evaluateTimeSeries(
    metric: MetricDefinition,
    periods: Array<{ start: string; end: string }>,
    grain: Grain,
    dimensions?: Record<string, string | string[]>
  ): Promise<Array<{ period: string; value: number }>> {
    const results = await Promise.all(
      periods.map(async (period) => {
        const result = await this.evaluate(metric, {
          startDate: period.start,
          endDate: period.end,
          grain,
          dimensions,
        });

        return {
          period: period.start, // Use start date as period identifier
          value: result.value,
        };
      })
    );

    return results;
  }

  /**
   * Get available dimension values for a model
   */
  async getAvailableDimensions(
    modelId: string,
    dimensionColumn: string
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('materialized_model_data')
      .select('dimensions')
      .eq('model_id', modelId)
      .not('dimensions', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch dimensions: ${error.message}`);
    }

    if (!data) return [];

    // Extract unique values for the specified dimension
    const uniqueValues = new Set<string>();
    for (const row of data) {
      const value = row.dimensions?.[dimensionColumn];
      if (value !== undefined && value !== null) {
        uniqueValues.add(String(value));
      }
    }

    return Array.from(uniqueValues).sort();
  }
}

// Singleton instance
let metricEvaluator: MetricEvaluator | null = null;

export function getMetricEvaluator(): MetricEvaluator {
  if (!metricEvaluator) {
    metricEvaluator = new MetricEvaluator();
  }
  return metricEvaluator;
}

