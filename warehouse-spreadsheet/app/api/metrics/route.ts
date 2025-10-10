import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { getMetricEvaluator } from '@/lib/metrics/evaluator';
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
 *   dimensions?: Record<string, string | string[]>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { metricName, grain, startDate, endDate, dimensions } = body;

    console.log(`[Metrics API] Request for metric: ${metricName}`, {
      grain,
      startDate,
      endDate,
      dimensions
    });

    // Validate inputs
    if (!metricName || !grain || !startDate || !endDate) {
      console.error('[Metrics API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: metricName, grain, startDate, endDate' },
        { status: 400 }
      );
    }

    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';
    const supabase = getServerSupabaseClient();

    // Find which model has this measure
    console.log('[Metrics API] Looking for model with measure:', metricName);
    const { data: models, error: modelsError } = await supabase
      .from('models_catalog')
      .select('id, name, measure_columns')
      .eq('org_id', orgId);

    if (modelsError) {
      console.error('[Metrics API] Error fetching models:', modelsError);
      throw modelsError;
    }

    console.log(`[Metrics API] Found ${models?.length || 0} models`);

    // Find the model that contains this metric (measure)
    const model = models?.find(m => 
      (m.measure_columns || []).includes(metricName)
    );

    if (!model) {
      console.error(`[Metrics API] No model found with measure: ${metricName}`);
      console.error(`[Metrics API] Available models and their measures:`, 
        models?.map(m => ({ name: m.name, measures: m.measure_columns }))
      );
      return NextResponse.json(
        { error: `Unknown metric: ${metricName}. No model found with this measure. Make sure the model is created and has been refreshed.` },
        { status: 404 }
      );
    }

    console.log(`[Metrics API] Found model: ${model.name} (${model.id})`);

    // Build metric definition from model
    const metricDef = {
      id: metricName,
      org_id: orgId,
      model_id: model.id,
      name: metricName,
      display_name: metricName.split('_').map(w => 
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join(' '),
      measure_column: metricName,
      aggregation: 'sum' as const, // Models pre-aggregate, so we sum across days
      filters: [],
      format_type: 'number' as const,
    };

    // Evaluate metric using materialized data
    console.log('[Metrics API] Evaluating metric...');
    const evaluator = getMetricEvaluator();
    const result = await evaluator.evaluate(metricDef, {
      startDate,
      endDate,
      grain,
      dimensions,
    });

    console.log(`[Metrics API] ✅ Result: value=${result.value}, rows_scanned=${result.rowsScanned}`);

    return NextResponse.json({
      metric: metricName,
      display_name: metricDef.display_name,
      value: result.value,
      grain,
      period: {
        start: startDate,
        end: endDate,
      },
      format: {
        type: 'number',
      },
      cached: false,
      source: 'materialized',
      rows_scanned: result.rowsScanned,
    });
  } catch (error) {
    console.error('[Metrics API] ❌ Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/metrics
 *
 * List all available metrics (derived from model measures)
 */
export async function GET() {
  try {
    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';
    const supabase = getServerSupabaseClient();

    // Get all models with their measures
    const { data: models, error } = await supabase
      .from('models_catalog')
      .select('id, name, measure_columns, dimension_columns')
      .eq('org_id', orgId);

    if (error) {
      throw error;
    }

    // Transform model measures into metrics
    const metrics: any[] = [];
    for (const model of models || []) {
      const measureColumns = model.measure_columns || [];
      const dimensionColumns = model.dimension_columns || [];
      
      for (const measure of measureColumns) {
        metrics.push({
          id: measure, // Use measure name as metric ID
          name: measure,
          display_name: measure.split('_').map((w: string) => 
            w.charAt(0).toUpperCase() + w.slice(1)
          ).join(' '),
          description: `${measure} from ${model.name} model`,
          model_id: model.id,
          model_name: model.name,
          measure_column: measure,
          dimensions: dimensionColumns,
          aggregation: 'sum', // Default, can be overridden
          format_type: 'number',
        });
      }
    }

    return NextResponse.json({
      metrics,
    });
  } catch (error) {
    console.error('List metrics API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
