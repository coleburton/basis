import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';

/**
 * GET /api/workbooks
 * 
 * List all workbooks for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';
    const supabase = getServerSupabaseClient();

    const { data: workbooks, error } = await supabase
      .from('workbooks')
      .select('*')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      workbooks: workbooks || [],
    });
  } catch (error) {
    console.error('List workbooks error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workbooks
 * 
 * Create a new workbook
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, org_id } = body;

    if (!name || !org_id) {
      return NextResponse.json(
        { error: 'name and org_id are required' },
        { status: 400 }
      );
    }

    const supabase = getServerSupabaseClient();

    const { data, error } = await supabase
      .from('workbooks')
      .insert({
        name,
        org_id,
        created_by: 'user', // Will be actual user ID when auth is implemented
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create workbook:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Create a default blank sheet for the new workbook
    const { error: sheetError } = await supabase
      .from('sheets')
      .insert({
        workbook_id: data.id,
        name: 'Sheet 1',
        position: 0,
        cell_data: { gridData: [], metricRanges: {}, metricCells: {} },
        num_rows: 50,
        num_cols: 10,
      });

    if (sheetError) {
      console.error('Failed to create default sheet:', sheetError);
      // Don't fail the whole request, just log the error
    }

    return NextResponse.json({
      success: true,
      workbook: data,
    });
  } catch (error) {
    console.error('Create workbook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

