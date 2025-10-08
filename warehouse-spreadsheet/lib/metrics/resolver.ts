import { getSnowflakeClient } from '@/lib/snowflake/client';
import { getCacheClient } from '@/lib/cache/redis';
import { getMetricDefinition } from './registry';
import { getGrainStart, getGrainEnd, formatDateForGrain } from '@/lib/formula/grain-inference';
import type { Grain, MetricRequest, MetricResponse } from '@/types';

/**
 * Resolves a metric query by fetching data from Snowflake (with caching)
 */
export class MetricResolver {
  private snowflake = getSnowflakeClient();
  private cache = getCacheClient();

  /**
   * Fetch metric value for a single period
   */
  async fetchMetric(
    orgId: string,
    request: MetricRequest
  ): Promise<MetricResponse> {
    const startTime = Date.now();

    const metricDef = getMetricDefinition(request.name);
    if (!metricDef) {
      throw new Error(`Unknown metric: ${request.name}`);
    }

    // Try to get from cache first
    const cachedValue = await this.cache.getMetric(
      orgId,
      request.name,
      request.grain,
      request.start,
      request.end,
      request.dimensions
    );

    if (cachedValue !== null) {
      return {
        metric: request.name,
        grain: request.grain,
        data: [
          {
            period: formatDateForGrain(new Date(request.start), request.grain),
            value: cachedValue,
            dimensions: request.dimensions,
          },
        ],
        cached: true,
        query_time_ms: Date.now() - startTime,
      };
    }

    // Build and execute Snowflake query
    const value = await this.querySnowflake(orgId, metricDef, request);

    // Cache the result
    await this.cache.setMetric(
      orgId,
      request.name,
      request.grain,
      request.start,
      request.end,
      value,
      request.dimensions
    );

    return {
      metric: request.name,
      grain: request.grain,
      data: [
        {
          period: formatDateForGrain(new Date(request.start), request.grain),
          value,
          dimensions: request.dimensions,
        },
      ],
      cached: false,
      query_time_ms: Date.now() - startTime,
    };
  }

  /**
   * Fetch metric values for a range of periods
   */
  async fetchMetricRange(
    orgId: string,
    metricName: string,
    periods: Array<{ start: string; end: string }>,
    grain: Grain,
    dimensions?: Record<string, string>
  ): Promise<MetricResponse> {
    const startTime = Date.now();

    const results = await Promise.all(
      periods.map((period) =>
        this.fetchMetric(orgId, {
          name: metricName,
          start: period.start,
          end: period.end,
          grain,
          dimensions,
        })
      )
    );

    // Combine results
    const data = results.flatMap((r) => r.data);
    const allCached = results.every((r) => r.cached);

    return {
      metric: metricName,
      grain,
      data,
      cached: allCached,
      query_time_ms: Date.now() - startTime,
    };
  }

  /**
   * Query Snowflake for metric value
   */
  private async querySnowflake(
    orgId: string,
    metricDef: ReturnType<typeof getMetricDefinition>,
    request: MetricRequest
  ): Promise<number> {
    if (!metricDef) {
      throw new Error('Metric definition is null');
    }

    // Build SQL query
    const grainTrunc = this.getGrainTruncFunction(request.grain);

    let sql = `
      SELECT ${metricDef.aggregation.toUpperCase()}(${metricDef.value_column}) as value
      FROM ${metricDef.source_table}
      WHERE ${metricDef.date_column} >= '${request.start}'
        AND ${metricDef.date_column} < '${request.end}'
    `;

    // Add dimension filters
    if (request.dimensions && Object.keys(request.dimensions).length > 0) {
      for (const [key, value] of Object.entries(request.dimensions)) {
        sql += `\n  AND ${key} = '${value}'`;
      }
    }

    try {
      const result = await this.snowflake.execute<{ VALUE: number }>(sql);

      if (result.rows.length === 0 || result.rows[0].VALUE === null) {
        // Handle fill strategy
        if (request.fill === 'zero') {
          return 0;
        }
        return 0; // Default to 0 for now
      }

      return result.rows[0].VALUE;
    } catch (error) {
      console.error('Snowflake query error:', error);
      throw new Error(`Failed to fetch metric: ${error}`);
    }
  }

  /**
   * Get Snowflake DATE_TRUNC function for grain
   */
  private getGrainTruncFunction(grain: Grain): string {
    switch (grain) {
      case 'day':
        return 'day';
      case 'month':
        return 'month';
      case 'quarter':
        return 'quarter';
      case 'year':
        return 'year';
    }
  }
}

// Singleton instance
let metricResolver: MetricResolver | null = null;

export function getMetricResolver(): MetricResolver {
  if (!metricResolver) {
    metricResolver = new MetricResolver();
  }
  return metricResolver;
}
