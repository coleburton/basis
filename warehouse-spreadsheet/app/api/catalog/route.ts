import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { getSnowflakeClient } from '@/lib/snowflake/client';

export async function GET(request: NextRequest) {
  try {
    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';
    const supabase = getServerSupabaseClient();

    // Get models from catalog
    const { data: models, error } = await supabase
      .from('models_catalog')
      .select('*')
      .eq('org_id', orgId)
      .order('name');

    if (error) {
      throw error;
    }

    // Also fetch tables from ANALYTICS schema
    const snowflake = getSnowflakeClient();
    const analyticsSchema = process.env.SNOWFLAKE_ANALYTICS_SCHEMA || 'ANALYTICS';
    const database = process.env.SNOWFLAKE_DATABASE!;

    let analyticsTables: Array<{ name: string; type: 'table' | 'view' }> = [];

    try {
      analyticsTables = await snowflake.listTables(database, analyticsSchema);
    } catch (error) {
      console.warn('Failed to fetch analytics tables:', error);
    }

    // Combine results
    const catalog = [
      ...models.map((m) => ({
        database: m.database,
        schema: m.schema,
        name: m.name,
        type: m.model_type,
        source: 'user_created',
      })),
      ...analyticsTables.map((t) => ({
        database,
        schema: analyticsSchema,
        name: t.name,
        type: t.type,
        source: 'analytics',
      })),
    ];

    return NextResponse.json({ catalog });
  } catch (error) {
    console.error('Catalog API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
