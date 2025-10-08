import { NextRequest, NextResponse } from 'next/server';
import { getModel, getMetric } from '@/lib/models/registry';
import { getMockExecutor } from '@/lib/models/mock-executor';
import type { Grain } from '@/types';

/**
 * POST /api/metrics
 *
 * Fetch a metric value for a specific time period
 *
 * Body:
 * {
 *   metricName: string,
 *   grain: 'quarter' | 'month' | 'year' | 'day',
 *   startDate: string (ISO date),
 *   endDate: string (ISO date),
 *   filters?: Record<string, string | number>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metricName, grain, startDate, endDate, filters } = body;

    // Validate inputs
    if (!metricName || !grain || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: metricName, grain, startDate, endDate' },
        { status: 400 }
      );
    }

    // Get metric and model
    const metric = getMetric(metricName);
    if (!metric) {
      return NextResponse.json(
        { error: `Unknown metric: ${metricName}` },
        { status: 404 }
      );
    }

    const model = getModel(metric.model_id.replace('model_', ''));
    if (!model) {
      return NextResponse.json(
        { error: `Model not found for metric: ${metricName}` },
        { status: 404 }
      );
    }

    // Execute query using mock data (replace with real Snowflake later)
    const executor = getMockExecutor();
    const value = await executor.executeMetricQuery(model, metric, {
      grain,
      startDate,
      endDate,
      dimensionFilters: filters,
    });

    return NextResponse.json({
      metric: metricName,
      display_name: metric.display_name,
      value,
      grain,
      period: {
        start: startDate,
        end: endDate,
      },
      format: {
        type: metric.format_type || 'number',
        currency: metric.currency_code,
      },
      cached: false,
      source: 'mock_data', // Change to 'snowflake' when using real data
    });
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/metrics
 *
 * List all available metrics
 */
export async function GET() {
  const { listMetrics } = await import('@/lib/models/registry');
  const metrics = listMetrics();

  return NextResponse.json({
    metrics: metrics.map(m => ({
      name: m.name,
      display_name: m.display_name,
      description: m.description,
      format_type: m.format_type,
      aggregation: m.aggregation,
    })),
  });
}
