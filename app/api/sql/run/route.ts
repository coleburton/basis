import { NextRequest, NextResponse } from 'next/server';
import { getSnowflakeClient } from '@/lib/snowflake/client';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import type { SqlRunRequest, SqlRunResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body: SqlRunRequest = await request.json();
    const { sql, model_name } = body;

    if (!sql) {
      return NextResponse.json(
        { error: 'Missing required field: sql' },
        { status: 400 }
      );
    }

    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';
    const userId = 'default_user'; // In production, get from auth

    const snowflake = getSnowflakeClient();
    const supabase = getServerSupabaseClient();

    // Validate SQL
    const validation = snowflake.validateSql(sql);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('sql_jobs')
      .insert({
        org_id: orgId,
        user_id: userId,
        sql,
        status: 'pending',
      })
      .select()
      .single();

    if (jobError || !job) {
      throw new Error('Failed to create job record');
    }

    // Execute SQL asynchronously
    executeJobAsync(job.id, orgId, sql, model_name);

    const response: SqlRunResponse = {
      job_id: job.id,
      status: 'pending',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('SQL run error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Execute job asynchronously
async function executeJobAsync(
  jobId: string,
  orgId: string,
  sql: string,
  modelName?: string
) {
  const snowflake = getSnowflakeClient();
  const supabase = getServerSupabaseClient();

  try {
    // Update status to running
    await supabase
      .from('sql_jobs')
      .update({ status: 'running' })
      .eq('id', jobId);

    const startTime = Date.now();

    // Execute SQL
    const result = await snowflake.execute(sql, {
      timeout: parseInt(process.env.SQL_TIMEOUT_SECONDS || '60', 10) * 1000,
    });

    const executionTime = Date.now() - startTime;

    // Update job with success
    await supabase
      .from('sql_jobs')
      .update({
        status: 'success',
        rows_affected: result.rowCount,
        execution_time_ms: executionTime,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    // If this was a model creation, register it in the catalog
    if (modelName) {
      await registerModel(orgId, sql, modelName);
    }
  } catch (error) {
    console.error('Job execution error:', error);

    // Update job with error
    await supabase
      .from('sql_jobs')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  }
}

// Register model in catalog
async function registerModel(orgId: string, sql: string, modelName: string) {
  const supabase = getServerSupabaseClient();

  // Parse schema/table from SQL (simple regex, could be improved)
  const createMatch = sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+([^.\s]+)\.([^.\s]+)\.([^\s(]+)/i);

  if (createMatch) {
    const [, database, schema, name] = createMatch;
    const modelType = sql.toUpperCase().includes('VIEW') ? 'view' : 'table';

    await supabase
      .from('models_catalog')
      .upsert({
        org_id: orgId,
        database,
        schema,
        name,
        model_type: modelType,
        sql_definition: sql,
        refreshed_at: new Date().toISOString(),
      }, {
        onConflict: 'org_id,database,schema,name',
      });
  }
}
