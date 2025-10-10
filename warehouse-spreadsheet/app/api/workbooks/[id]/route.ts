import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase/client'
import { gridDataToSparse, sparseToGridData, type SparseCellData } from '@/lib/workbook/sparse-storage'
import type { CellContent, MetricRangeConfig } from '@/lib/workbook/workbook-context'

/**
 * GET /api/workbooks/[id]
 * Load a workbook with all its sheets and data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = getServerSupabaseClient()

    // Fetch workbook metadata
    const { data: workbook, error: workbookError } = await supabase
      .from('workbooks')
      .select('*')
      .eq('id', id)
      .single()

    if (workbookError) {
      if (workbookError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Workbook not found' },
          { status: 404 }
        )
      }
      throw workbookError
    }

    // Update last_opened_at timestamp
    await supabase.rpc('update_workbook_last_opened', { workbook_uuid: id })

    // Fetch all sheets for this workbook
    const { data: sheets, error: sheetsError } = await supabase
      .from('sheets')
      .select('*')
      .eq('workbook_id', id)
      .order('position')

    if (sheetsError) {
      throw sheetsError
    }

    // Fetch metric ranges for all sheets
    const sheetIds = sheets.map(s => s.id)
    const { data: metricRanges, error: metricRangesError } = await supabase
      .from('metric_ranges')
      .select('*')
      .in('sheet_id', sheetIds)

    if (metricRangesError) {
      throw metricRangesError
    }

    // Convert sparse cell data to dense grid format
    const sheetsWithGridData = sheets.map(sheet => {
      const cellData = sheet.cell_data as SparseCellData
      const gridData = sparseToGridData(
        cellData,
        sheet.num_rows || 50,
        sheet.num_cols || 10
      )

      // Build metric ranges map for this sheet
      const sheetMetricRanges = metricRanges
        .filter(mr => mr.sheet_id === sheet.id)
        .reduce((acc, mr) => {
          acc[mr.range_id] = mr.config as MetricRangeConfig
          return acc
        }, {} as Record<string, MetricRangeConfig>)

      return {
        id: sheet.id,
        name: sheet.name,
        gridData,
        metricRanges: sheetMetricRanges,
        metricCells: {}, // Metric cells will be evaluated on the client
        hyperformulaSheetId: sheet.hyperformula_sheet_id
      }
    })

    return NextResponse.json({
      id: workbook.id,
      name: workbook.name,
      description: workbook.description,
      createdAt: workbook.created_at,
      updatedAt: workbook.updated_at,
      sheets: sheetsWithGridData
    })
  } catch (error) {
    console.error('Workbook fetch API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/workbooks/[id]
 * Save/update a workbook and all its sheets
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = getServerSupabaseClient()
    const body = await request.json()

    const { name, description, sheets } = body

    // Update workbook metadata
    if (name || description !== undefined) {
      const { error: workbookError } = await supabase
        .from('workbooks')
        .update({
          ...(name && { name }),
          ...(description !== undefined && { description })
        })
        .eq('id', id)

      if (workbookError) {
        throw workbookError
      }
    }

    // Update each sheet if provided
    if (sheets && Array.isArray(sheets)) {
      for (const sheet of sheets) {
        // Convert dense grid data to sparse format
        const sparse = gridDataToSparse(sheet.gridData as CellContent[][])

        // Update sheet
        const { error: sheetError } = await supabase
          .from('sheets')
          .update({
            name: sheet.name,
            cell_data: sparse,
            ...(sheet.hyperformulaSheetId !== undefined && {
              hyperformula_sheet_id: sheet.hyperformulaSheetId
            })
          })
          .eq('id', sheet.id)

        if (sheetError) {
          throw sheetError
        }

        // Update metric ranges
        // First, delete all existing metric ranges for this sheet
        await supabase
          .from('metric_ranges')
          .delete()
          .eq('sheet_id', sheet.id)

        // Then insert new ones
        const metricRangeRows = Object.entries(sheet.metricRanges || {}).map(
          ([rangeId, config]) => ({
            sheet_id: sheet.id,
            range_id: rangeId,
            metric_id: (config as MetricRangeConfig).metricId,
            config: config
          })
        )

        if (metricRangeRows.length > 0) {
          const { error: metricRangesError } = await supabase
            .from('metric_ranges')
            .insert(metricRangeRows)

          if (metricRangesError) {
            throw metricRangesError
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Workbook save API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workbooks/[id]
 * Delete a workbook and all associated data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = getServerSupabaseClient()

    // Delete workbook (cascade will delete sheets and metric_ranges)
    const { error } = await supabase
      .from('workbooks')
      .delete()
      .eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Workbook delete API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
