import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';

/**
 * GET /api/workbooks/[id]
 * 
 * Load a specific workbook with all its sheets and data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workbookId = params.id;
    console.log(`[Workbooks API] Loading workbook: ${workbookId}`);
    
    const supabase = getServerSupabaseClient();

    // Load workbook metadata
    const { data: workbook, error: workbookError } = await supabase
      .from('workbooks')
      .select('*')
      .eq('id', workbookId)
      .single();

    if (workbookError || !workbook) {
      console.error(`[Workbooks API] Workbook not found:`, workbookError);
      return NextResponse.json(
        { error: 'Workbook not found' },
        { status: 404 }
      );
    }

    // Load sheets for this workbook
    const { data: sheets, error: sheetsError } = await supabase
      .from('sheets')
      .select('*')
      .eq('workbook_id', workbookId)
      .order('position', { ascending: true });

    if (sheetsError) {
      console.error(`[Workbooks API] Failed to load sheets:`, sheetsError);
      throw sheetsError;
    }

    console.log(`[Workbooks API] ✅ Loaded workbook with ${sheets?.length || 0} sheets`);

    return NextResponse.json({
      workbook: {
        ...workbook,
        sheets: sheets || [],
      },
    });
  } catch (error) {
    console.error('[Workbooks API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workbooks/[id]
 * 
 * Update workbook metadata and save sheet data
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workbookId = params.id;
    const body = await request.json();
    
    console.log(`[Workbooks API] Saving workbook: ${workbookId}`);
    
    const supabase = getServerSupabaseClient();

    // Update workbook metadata if provided
    if (body.name) {
      const { error: updateError } = await supabase
        .from('workbooks')
        .update({ name: body.name })
        .eq('id', workbookId);

      if (updateError) {
        throw updateError;
      }
    }

    // Save sheets data if provided
    if (body.sheets && Array.isArray(body.sheets)) {
      console.log(`[Workbooks API] Saving ${body.sheets.length} sheets`);
      
      for (const sheet of body.sheets) {
        const { id, name, position, cell_data } = sheet;
        
        // Log cell_data structure
        console.log(`[Workbooks API] Sheet "${name}" cell_data structure:`, {
          hasGridData: !!cell_data?.gridData,
          gridDataIsArray: Array.isArray(cell_data?.gridData),
          gridDataLength: cell_data?.gridData?.length,
          hasMetricRanges: !!cell_data?.metricRanges,
          hasMetricCells: !!cell_data?.metricCells,
        });
        
        if (!id) {
          // Create new sheet
          const { error: insertError } = await supabase
            .from('sheets')
            .insert({
              workbook_id: workbookId,
              name: name || 'Untitled Sheet',
              position: position || 0,
              cell_data: cell_data || {},
              num_rows: 50,
              num_cols: 10,
            });

          if (insertError) {
            console.error(`[Workbooks API] Failed to insert sheet:`, insertError);
            throw insertError;
          }
        } else {
          // Update existing sheet
          const { error: updateError } = await supabase
            .from('sheets')
            .update({
              name,
              position,
              cell_data,
            })
            .eq('id', id);

          if (updateError) {
            console.error(`[Workbooks API] Failed to update sheet:`, updateError);
            throw updateError;
          }
          
          console.log(`[Workbooks API] ✅ Updated sheet "${name}" successfully`);
        }
      }
    }

    console.log(`[Workbooks API] ✅ Workbook saved successfully`);

    return NextResponse.json({
      success: true,
      message: 'Workbook saved',
    });
  } catch (error) {
    console.error('[Workbooks API] Save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workbooks/[id]
 * 
 * Delete a workbook and all its sheets
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workbookId = params.id;
    const supabase = getServerSupabaseClient();

    // Delete workbook (sheets will be cascade deleted)
    const { error: deleteError } = await supabase
      .from('workbooks')
      .delete()
      .eq('id', workbookId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({
      success: true,
      message: 'Workbook deleted',
    });
  } catch (error) {
    console.error('[Workbooks API] Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

