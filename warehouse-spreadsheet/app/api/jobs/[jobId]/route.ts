import { NextRequest, NextResponse } from 'next/server';
import { getRefreshWorker } from '@/lib/jobs/model-refresh-worker';

/**
 * GET /api/jobs/[jobId]
 * 
 * Get status of a refresh job
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    const worker = getRefreshWorker();
    const status = await worker.getJobStatus(jobId);

    if (!status) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      jobId,
      ...status,
    });
  } catch (error) {
    console.error('Job status API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

