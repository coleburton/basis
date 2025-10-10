import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { EXAMPLE_MODELS, createModelFromDefinition, createMetricsForModel } from '@/lib/models/example-models';

/**
 * POST /api/setup-example
 * 
 * Quick setup endpoint to create an example model and metrics
 * This helps you get started quickly with a working example
 * 
 * Body:
 * {
 *   model: 'new_users' | 'revenue' | 'marketing_spend'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { model: modelName = 'new_users' } = body;

    if (!EXAMPLE_MODELS[modelName as keyof typeof EXAMPLE_MODELS]) {
      return NextResponse.json(
        { error: `Unknown example model: ${modelName}. Choose from: ${Object.keys(EXAMPLE_MODELS).join(', ')}` },
        { status: 400 }
      );
    }

    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';
    const supabase = getServerSupabaseClient();
    const modelDef = EXAMPLE_MODELS[modelName as keyof typeof EXAMPLE_MODELS];

    // Create model
    console.log(`Creating model: ${modelName}`);
    const modelId = await createModelFromDefinition(supabase, orgId, modelDef);

    // Create example metrics based on model type
    let metrics: any[] = [];
    
    if (modelName === 'new_users') {
      metrics = [
        {
          name: 'new_users',
          display_name: 'New Users',
          description: 'Total count of new user signups',
          measure_column: 'new_users',
          aggregation: 'sum',
          format_type: 'number',
        },
        {
          name: 'signup_revenue',
          display_name: 'Signup Revenue',
          description: 'Revenue from initial signups',
          measure_column: 'signup_revenue',
          aggregation: 'sum',
          format_type: 'currency',
          currency_code: 'USD',
        },
      ];
    } else if (modelName === 'revenue') {
      metrics = [
        {
          name: 'total_revenue',
          display_name: 'Total Revenue',
          description: 'Sum of all completed order revenue',
          measure_column: 'revenue',
          aggregation: 'sum',
          format_type: 'currency',
          currency_code: 'USD',
        },
        {
          name: 'order_count',
          display_name: 'Order Count',
          description: 'Number of completed orders',
          measure_column: 'orders',
          aggregation: 'sum',
          format_type: 'number',
        },
        {
          name: 'avg_order_value',
          display_name: 'Average Order Value',
          description: 'Average revenue per order',
          measure_column: 'avg_order_value',
          aggregation: 'avg',
          format_type: 'currency',
          currency_code: 'USD',
        },
      ];
    } else if (modelName === 'marketing_spend') {
      metrics = [
        {
          name: 'total_spend',
          display_name: 'Total Marketing Spend',
          description: 'Sum of all marketing spend',
          measure_column: 'spend',
          aggregation: 'sum',
          format_type: 'currency',
          currency_code: 'USD',
        },
        {
          name: 'total_impressions',
          display_name: 'Total Impressions',
          description: 'Sum of ad impressions',
          measure_column: 'impressions',
          aggregation: 'sum',
          format_type: 'number',
        },
        {
          name: 'total_clicks',
          display_name: 'Total Clicks',
          description: 'Sum of ad clicks',
          measure_column: 'clicks',
          aggregation: 'sum',
          format_type: 'number',
        },
      ];
    }

    console.log(`Creating ${metrics.length} metrics for model`);
    await createMetricsForModel(supabase, orgId, modelId, metrics);

    return NextResponse.json({
      success: true,
      model: {
        id: modelId,
        name: modelName,
        sql: modelDef.sql,
        dimensions: modelDef.dimension_columns,
        measures: modelDef.measure_columns,
      },
      metrics: metrics.map(m => m.name),
      next_steps: [
        `1. Trigger refresh: POST /api/models/refresh with {"modelId": "${modelId}"}`,
        `2. Check job status: GET /api/jobs/:jobId`,
        `3. Query metrics: POST /api/metrics with {"metricName": "${metrics[0].name}", "grain": "quarter", "startDate": "2024-01-01", "endDate": "2024-04-01"}`,
        `4. View in UI: Go to /models and select "${modelName}"`,
      ],
    });
  } catch (error) {
    console.error('Setup example error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/setup-example
 * 
 * List available example models
 */
export async function GET() {
  return NextResponse.json({
    available_models: Object.entries(EXAMPLE_MODELS).map(([name, def]) => ({
      name,
      description: def.description,
      dimensions: def.dimension_columns,
      measures: def.measure_columns,
    })),
    usage: 'POST /api/setup-example with {"model": "new_users"}',
  });
}

