import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';

/**
 * POST /api/models/create
 * 
 * Create a new model in the catalog
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      org_id,
      name,
      database,
      schema,
      model_type,
      sql_definition,
      primary_date_column,
      date_grain,
      dimension_columns,
      measure_columns,
    } = body;

    // Validate required fields
    if (!org_id || !name || !database || !schema) {
      return NextResponse.json(
        { error: 'Missing required fields: org_id, name, database, schema' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();

    // Insert the model
    const { data, error } = await supabase
      .from('models_catalog')
      .insert({
        org_id,
        name,
        database,
        schema,
        model_type: model_type || 'view',
        sql_definition,
        primary_date_column,
        date_grain: date_grain || 'day',
        dimension_columns,
        measure_columns,
        created_by: 'user',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create model:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      model: data,
    });
  } catch (error) {
    console.error('Create model error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

