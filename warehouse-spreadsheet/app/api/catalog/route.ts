import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { getMaterializationEngine } from '@/lib/models/materialization';

export async function GET(request: NextRequest) {
  try {
    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';
    const supabase = getServerSupabaseClient();

    // Get models from catalog with all materialization fields
    const { data: models, error } = await supabase
      .from('models_catalog')
      .select('*')
      .eq('org_id', orgId)
      .order('name');

    if (error) {
      throw error;
    }

    // Get materialization stats for each model
    const materializationEngine = getMaterializationEngine();
    const catalog = await Promise.all(
      (models || []).map(async (model) => {
        let stats = null;
        try {
          stats = await materializationEngine.getStats(model.id);
        } catch (error) {
          console.warn(`Failed to get stats for model ${model.name}:`, error);
        }

        return {
          id: model.id,
          database: model.database,
          schema: model.schema,
          name: model.name,
          type: model.model_type,
          description: model.sql_definition ? 'Custom SQL model' : 'Table model',
          sql_definition: model.sql_definition,
          primary_date_column: model.primary_date_column,
          date_grain: model.date_grain,
          dimension_columns: model.dimension_columns || [],
          measure_columns: model.measure_columns || [],
          refresh_schedule: model.refresh_schedule,
          last_refresh_at: model.last_refresh_at,
          materialized_rows: stats?.totalRows || 0,
          date_range: stats?.dateRange || null,
        };
      })
    );

    return NextResponse.json({ catalog });
  } catch (error) {
    console.error('Catalog API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
