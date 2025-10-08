import type { Model, MetricDefinition, MetricFilter, Grain } from '@/types';

/**
 * Query Builder for Semantic Layer
 *
 * Builds SQL queries that:
 * 1. Pull from the correct Model (table/view)
 * 2. Apply the correct time filters based on cell context (Q1 2024, Q2 2024, etc.)
 * 3. Aggregate using the metric's aggregation function
 * 4. Apply any filters defined on the metric or workbook connection
 */

export interface QueryContext {
  // Time dimension from the cell's column header
  grain: Grain; // 'quarter', 'month', 'year', 'day'
  startDate: string; // ISO date string, e.g., '2024-01-01'
  endDate: string; // ISO date string, e.g., '2024-03-31'

  // Optional: Additional filters from workbook data connection
  globalFilters?: Record<string, string | number>;

  // Optional: Dimension filters (e.g., region='US')
  dimensionFilters?: Record<string, string | number>;
}

export class QueryBuilder {
  /**
   * Build a SQL query to fetch a metric value for a specific context
   */
  buildMetricQuery(
    model: Model,
    metric: MetricDefinition,
    context: QueryContext
  ): string {
    const { database, schema, table, primary_date_column } = model;
    const { measure_column, aggregation, filters } = metric;

    // Build the aggregation expression
    const aggExpr = this.buildAggregationExpression(aggregation, measure_column);

    // Start building the query
    let query = `SELECT ${aggExpr} as value\n`;
    query += `FROM ${database}.${schema}.${table}\n`;

    // WHERE clause
    const whereConditions: string[] = [];

    // 1. Time filter (always applied based on cell context)
    whereConditions.push(
      `${primary_date_column} >= '${context.startDate}'`
    );
    whereConditions.push(
      `${primary_date_column} < '${context.endDate}'`
    );

    // 2. Metric-level filters (defined on the metric itself)
    if (filters && filters.length > 0) {
      for (const filter of filters) {
        whereConditions.push(this.buildFilterCondition(filter));
      }
    }

    // 3. Global filters from workbook connection
    if (context.globalFilters) {
      for (const [column, value] of Object.entries(context.globalFilters)) {
        whereConditions.push(this.buildSimpleFilter(column, value));
      }
    }

    // 4. Dimension filters (from formula arguments or cell context)
    if (context.dimensionFilters) {
      for (const [column, value] of Object.entries(context.dimensionFilters)) {
        whereConditions.push(this.buildSimpleFilter(column, value));
      }
    }

    if (whereConditions.length > 0) {
      query += `WHERE ${whereConditions.join('\n  AND ')}\n`;
    }

    return query;
  }

  /**
   * Build aggregation expression
   */
  private buildAggregationExpression(
    aggregation: MetricDefinition['aggregation'],
    column: string
  ): string {
    switch (aggregation) {
      case 'sum':
        return `SUM(${column})`;
      case 'avg':
        return `AVG(${column})`;
      case 'count':
        return `COUNT(${column})`;
      case 'count_distinct':
        return `COUNT(DISTINCT ${column})`;
      case 'min':
        return `MIN(${column})`;
      case 'max':
        return `MAX(${column})`;
      default:
        throw new Error(`Unknown aggregation: ${aggregation}`);
    }
  }

  /**
   * Build a filter condition from MetricFilter
   */
  private buildFilterCondition(filter: MetricFilter): string {
    const { column, operator, value } = filter;

    switch (operator) {
      case 'eq':
        return `${column} = ${this.formatValue(value)}`;
      case 'neq':
        return `${column} != ${this.formatValue(value)}`;
      case 'gt':
        return `${column} > ${this.formatValue(value)}`;
      case 'gte':
        return `${column} >= ${this.formatValue(value)}`;
      case 'lt':
        return `${column} < ${this.formatValue(value)}`;
      case 'lte':
        return `${column} <= ${this.formatValue(value)}`;
      case 'in':
        if (Array.isArray(value)) {
          const values = value.map((v) => this.formatValue(v)).join(', ');
          return `${column} IN (${values})`;
        }
        throw new Error('IN operator requires array value');
      case 'not_in':
        if (Array.isArray(value)) {
          const values = value.map((v) => this.formatValue(v)).join(', ');
          return `${column} NOT IN (${values})`;
        }
        throw new Error('NOT IN operator requires array value');
      case 'like':
        return `${column} LIKE ${this.formatValue(value)}`;
      default:
        throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Build a simple equality filter
   */
  private buildSimpleFilter(column: string, value: string | number): string {
    return `${column} = ${this.formatValue(value)}`;
  }

  /**
   * Format value for SQL (add quotes for strings)
   */
  private formatValue(value: string | number | boolean | Array<string | number>): string {
    if (Array.isArray(value)) {
      return value.map((v) => this.formatValue(v)).join(', ');
    }

    if (typeof value === 'string') {
      // Escape single quotes
      const escaped = value.replace(/'/g, "''");
      return `'${escaped}'`;
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    return String(value);
  }

  /**
   * Get the SQL DATE_TRUNC function for a grain
   * This is useful for grouping by time periods
   */
  getDateTruncFunction(grain: Grain, dateColumn: string): string {
    switch (grain) {
      case 'day':
        return `DATE_TRUNC('day', ${dateColumn})`;
      case 'month':
        return `DATE_TRUNC('month', ${dateColumn})`;
      case 'quarter':
        return `DATE_TRUNC('quarter', ${dateColumn})`;
      case 'year':
        return `DATE_TRUNC('year', ${dateColumn})`;
      default:
        throw new Error(`Unknown grain: ${grain}`);
    }
  }
}

// Singleton instance
let queryBuilder: QueryBuilder | null = null;

export function getQueryBuilder(): QueryBuilder {
  if (!queryBuilder) {
    queryBuilder = new QueryBuilder();
  }
  return queryBuilder;
}
