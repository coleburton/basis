import { NextRequest, NextResponse } from 'next/server';
import { getMetricResolver } from '@/lib/metrics/resolver';
import { isValidMetric } from '@/lib/metrics/registry';
import type { Grain } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { name: string } }
) {
  try {
    const { name } = params;
    const searchParams = request.nextUrl.searchParams;

    // Validate metric name
    if (!isValidMetric(name)) {
      return NextResponse.json(
        { error: `Unknown metric: ${name}` },
        { status: 404 }
      );
    }

    // Parse query parameters
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const grain = (searchParams.get('grain') || 'month') as Grain;
    const dimsParam = searchParams.get('dims');
    const fill = searchParams.get('fill') as 'zero' | 'null' | 'forward' | undefined;
    const fiscal = searchParams.get('fiscal') === 'true';

    // Validate required parameters
    if (!start || !end) {
      return NextResponse.json(
        { error: 'Missing required parameters: start, end' },
        { status: 400 }
      );
    }

    // Parse dimensions
    let dimensions: Record<string, string> | undefined;
    if (dimsParam) {
      try {
        dimensions = JSON.parse(dimsParam);
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid dimensions JSON' },
          { status: 400 }
        );
      }
    }

    // Get org ID from env (in production, this would come from auth)
    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';

    // Fetch metric
    const resolver = getMetricResolver();
    const result = await resolver.fetchMetric(orgId, {
      name,
      start,
      end,
      grain,
      dimensions,
      fill,
      fiscal,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Metrics API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
