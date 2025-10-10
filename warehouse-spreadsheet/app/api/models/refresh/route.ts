import { NextRequest, NextResponse } from 'next/server';
import { getRefreshWorker } from '@/lib/jobs/model-refresh-worker';

/**
 * POST /api/models/refresh
 * 
 * Trigger a model refresh (materialization)
 * 
 * Body:
 * {
 *   modelId: string,
 *   incremental?: boolean,
 *   startDate?: string,
 *   endDate?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { modelId, incremental = false, startDate, endDate } = body;

    if (!modelId) {
      return NextResponse.json(
        { error: 'modelId is required' },
        { status: 400 }
      );
    }

    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';
    const worker = getRefreshWorker();

    // Create job
    const jobId = await worker.createJob(modelId, orgId, {
      incremental,
      startDate,
      endDate,
    });

    // Process job immediately (in production, this would be queued)
    // For now, we'll process it in the background using a promise
    // that we don't await
    worker.processJob({
      jobId,
      modelId,
      orgId,
      incremental,
      startDate,
      endDate,
    }).catch(error => {
      console.error('Background job error:', error);
    });

    return NextResponse.json({
      jobId,
      status: 'pending',
      message: 'Refresh job created',
    });
  } catch (error) {
    console.error('Refresh API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

