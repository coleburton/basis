import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabaseClient } from '@/lib/supabase/client'
import { nanoid } from 'nanoid'

/**
 * GET /api/workbooks
 * List all workbooks for the current org
 */
export async function GET(request: NextRequest) {
  try {
    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default'
    const supabase = getServerSupabaseClient()

    const { data: workbooks, error } = await supabase
      .from('workbooks')
      .select('id, name, description, created_at, updated_at, last_opened_at')
      .eq('org_id', orgId)
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Error fetching workbooks:', error)
      throw error
    }

    return NextResponse.json({ workbooks })
  } catch (error) {
    console.error('Workbooks list API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workbooks
 * Create a new workbook with default sheets
 */
export async function POST(request: NextRequest) {
  try {
    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default'
    const supabase = getServerSupabaseClient()
    const body = await request.json()

    const { name, description } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Workbook name is required' },
        { status: 400 }
      )
    }

    // Create workbook
    const { data: workbook, error: workbookError } = await supabase
      .from('workbooks')
      .insert({
        name,
        description: description || '',
        org_id: orgId
      })
      .select()
      .single()

    if (workbookError) {
      console.error('Error creating workbook:', workbookError)
      throw workbookError
    }

    // Create initial sheet
    const { data: sheet, error: sheetError } = await supabase
      .from('sheets')
      .insert({
        workbook_id: workbook.id,
        name: 'Sheet 1',
        position: 0,
        cell_data: {}
      })
      .select()
      .single()

    if (sheetError) {
      console.error('Error creating initial sheet:', sheetError)
      throw sheetError
    }

    return NextResponse.json({
      workbook: {
        ...workbook,
        sheets: [
          {
            id: sheet.id,
            name: sheet.name,
            position: sheet.position,
            metricRanges: {}
          }
        ]
      }
    })
  } catch (error) {
    console.error('Workbook creation API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
