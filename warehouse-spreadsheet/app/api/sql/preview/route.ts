import { NextRequest, NextResponse } from 'next/server';
import { getSnowflakeClient } from '@/lib/snowflake/client';
import type { SqlPreviewRequest, SqlPreviewResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: SqlPreviewRequest = await request.json();
    const { sql } = body;

    if (!sql) {
      return NextResponse.json(
        { error: 'Missing required field: sql' },
        { status: 400 }
      );
    }

    const snowflake = getSnowflakeClient();

    // Validate SQL
    const validation = snowflake.validateSql(sql);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Execute preview (limited to 200 rows)
    const result = await snowflake.preview(sql, 200);

    const response: SqlPreviewResponse = {
      columns: result.columns.map((col) => col.name),
      rows: result.rows,
      total_rows: result.totalRows,
      limited: result.limited,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('SQL preview error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
