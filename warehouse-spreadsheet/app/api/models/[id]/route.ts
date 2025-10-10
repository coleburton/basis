import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';

/**
 * PATCH /api/models/[id]
 * 
 * Update an existing model definition
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const modelId = params.id;
    const body = await request.json();
    
    console.log(`[Update Model API] Updating model ${modelId}`, body);
    
    const {
      name,
      database,
      schema,
      sql_definition,
      primary_date_column,
      date_grain,
      dimension_columns,
      measure_columns,
    } = body;

    // Validate required fields
    if (!name || !database || !schema) {
      console.error('[Update Model API] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: name, database, schema' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();

    // Check if model exists
    const { data: existingModel, error: fetchError } = await supabase
      .from('models_catalog')
      .select('id, name, database, schema')
      .eq('id', modelId)
      .single();

    if (fetchError || !existingModel) {
      console.error('[Update Model API] Model not found:', modelId);
      return NextResponse.json(
        { error: 'Model not found' },
        { status: 404 }
      );
    }

    console.log('[Update Model API] Existing model:', existingModel);
    console.log('[Update Model API] Updating with:', { name, database, schema });

    // Update the model
    const { data: updatedModel, error: updateError } = await supabase
      .from('models_catalog')
      .update({
        name,
        database,
        schema,
        sql_definition,
        primary_date_column,
        date_grain: date_grain || 'day',
        dimension_columns: dimension_columns || [],
        measure_columns: measure_columns || [],
      })
      .eq('id', modelId)
      .select()
      .single();

    if (updateError) {
      console.error('[Update Model API] Error updating model:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    console.log('[Update Model API] ✅ Successfully updated:', updatedModel);

    return NextResponse.json({
      success: true,
      model: updatedModel,
    });
  } catch (error) {
    console.error('[Update Model API] ❌ Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/models/[id]
 * 
 * Delete a model (optional - can be added later)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const modelId = params.id;
    const supabase = getServerSupabaseClient();

    // Delete the model (cascades to metrics and materialized data via FK constraints)
    const { error: deleteError } = await supabase
      .from('models_catalog')
      .delete()
      .eq('id', modelId);

    if (deleteError) {
      console.error('Error deleting model:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Model deleted successfully',
    });
  } catch (error) {
    console.error('Delete model API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

