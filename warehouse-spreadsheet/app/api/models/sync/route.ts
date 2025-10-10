import { NextRequest, NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { syncModelsToDatabase, syncMetricsToDatabase } from '@/lib/models/registry';

/**
 * POST /api/models/sync
 * 
 * Sync code-defined models and metrics to the database
 * This is useful for initial setup or when models are updated in code
 */
export async function POST(request: NextRequest) {
  try {
    const orgId = process.env.NEXT_PUBLIC_ORG_ID || 'default_org';
    const supabase = getServerSupabaseClient();

    // Sync models
    await syncModelsToDatabase(supabase, orgId);
    
    // Sync metrics
    await syncMetricsToDatabase(supabase, orgId);

    return NextResponse.json({
      success: true,
      message: 'Models and metrics synced successfully',
    });
  } catch (error) {
    console.error('Sync API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

