/**
 * Mock Query Executor
 *
 * Executes SQL-like queries against in-memory mock data.
 * This lets you test the UI without needing Snowflake.
 */

import { MOCK_USERS, MOCK_REVENUE, type MockUser, type MockRevenue } from './mock-data';
import type { Model, MetricDefinition } from '@/types';
import type { QueryContext } from './query-builder';

export class MockQueryExecutor {
  /**
   * Execute a metric query against mock data
   */
  async executeMetricQuery(
    model: Model,
    metric: MetricDefinition,
    context: QueryContext
  ): Promise<number> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the appropriate dataset
    const dataset = this.getDataset(model);

    // Filter by date range
    let filtered = this.filterByDateRange(
      dataset,
      model.primary_date_column,
      context.startDate,
      context.endDate
    );

    // Apply metric filters
    if (metric.filters) {
      filtered = this.applyFilters(filtered, metric.filters);
    }

    // Apply global filters
    if (context.globalFilters) {
      filtered = this.applySimpleFilters(filtered, context.globalFilters);
    }

    // Apply dimension filters
    if (context.dimensionFilters) {
      filtered = this.applySimpleFilters(filtered, context.dimensionFilters);
    }

    // Apply aggregation
    const result = this.aggregate(filtered, metric.measure_column, metric.aggregation);

    return result;
  }

  /**
   * Get the appropriate mock dataset for a model
   */
  private getDataset(model: Model): any[] {
    if (model.name === 'users') {
      return MOCK_USERS;
    } else if (model.name === 'revenue') {
      return MOCK_REVENUE;
    }

    throw new Error(`Unknown model: ${model.name}`);
  }

  /**
   * Filter by date range
   */
  private filterByDateRange(
    data: any[],
    dateColumn: string,
    startDate: string,
    endDate: string
  ): any[] {
    return data.filter(row => {
      const rowDate = row[dateColumn];
      if (!rowDate) return false;

      // Handle both ISO timestamps and dates
      const dateStr = rowDate.split('T')[0]; // Get just the date part
      return dateStr >= startDate && dateStr < endDate;
    });
  }

  /**
   * Apply metric filters
   */
  private applyFilters(data: any[], filters: MetricDefinition['filters']): any[] {
    if (!filters || filters.length === 0) return data;

    return data.filter(row => {
      return filters.every(filter => {
        const { column, operator, value } = filter;
        const rowValue = row[column];

        switch (operator) {
          case 'eq':
            return rowValue === value;
          case 'neq':
            return rowValue !== value;
          case 'gt':
            return rowValue > value;
          case 'gte':
            return rowValue >= value;
          case 'lt':
            return rowValue < value;
          case 'lte':
            return rowValue <= value;
          case 'in':
            return Array.isArray(value) && value.includes(rowValue);
          case 'not_in':
            return Array.isArray(value) && !value.includes(rowValue);
          case 'like':
            if (typeof value === 'string' && typeof rowValue === 'string') {
              const pattern = value.replace(/%/g, '.*');
              return new RegExp(`^${pattern}$`, 'i').test(rowValue);
            }
            return false;
          default:
            return true;
        }
      });
    });
  }

  /**
   * Apply simple filters (object of column: value)
   */
  private applySimpleFilters(data: any[], filters: Record<string, string | number>): any[] {
    return data.filter(row => {
      return Object.entries(filters).every(([column, value]) => {
        return row[column] === value;
      });
    });
  }

  /**
   * Apply aggregation function
   */
  private aggregate(
    data: any[],
    column: string,
    aggregation: MetricDefinition['aggregation']
  ): number {
    if (data.length === 0) return 0;

    switch (aggregation) {
      case 'count':
        return data.filter(row => row[column] != null).length;

      case 'count_distinct': {
        const uniqueValues = new Set(data.map(row => row[column]).filter(v => v != null));
        return uniqueValues.size;
      }

      case 'sum': {
        return data.reduce((sum, row) => {
          const val = parseFloat(row[column]);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
      }

      case 'avg': {
        const values = data.map(row => parseFloat(row[column])).filter(v => !isNaN(v));
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      }

      case 'min': {
        const values = data.map(row => parseFloat(row[column])).filter(v => !isNaN(v));
        if (values.length === 0) return 0;
        return Math.min(...values);
      }

      case 'max': {
        const values = data.map(row => parseFloat(row[column])).filter(v => !isNaN(v));
        if (values.length === 0) return 0;
        return Math.max(...values);
      }

      default:
        throw new Error(`Unknown aggregation: ${aggregation}`);
    }
  }
}

// Singleton instance
let mockExecutor: MockQueryExecutor | null = null;

export function getMockExecutor(): MockQueryExecutor {
  if (!mockExecutor) {
    mockExecutor = new MockQueryExecutor();
  }
  return mockExecutor;
}
