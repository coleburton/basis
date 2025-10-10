/**
 * Model Refresh Worker
 * 
 * Processes model refresh jobs - executes materialization
 * and updates job status.
 */

import { getServerSupabaseClient } from '@/lib/supabase/client';
import { getMaterializationEngine, type ModelDefinition } from '@/lib/models/materialization';

export interface RefreshJobConfig {
  jobId: string;
  modelId: string;
  orgId: string;
  incremental?: boolean;
  startDate?: string;
  endDate?: string;
}

export class ModelRefreshWorker {
  private supabase = getServerSupabaseClient();
  private materializationEngine = getMaterializationEngine();

  /**
   * Process a refresh job
   */
  async processJob(config: RefreshJobConfig): Promise<void> {
    const { jobId, modelId, orgId } = config;

    try {
      // Update job status to running
      await this.updateJobStatus(jobId, 'running', { started_at: new Date().toISOString() });

      // Get model definition
      const model = await this.getModel(modelId, orgId);
      if (!model) {
        throw new Error(`Model not found: ${modelId}`);
      }

      // Execute materialization
      const result = await this.materializationEngine.materialize(model, {
        incremental: config.incremental,
        startDate: config.startDate,
        endDate: config.endDate,
      });

      if (result.success) {
        // Update job as successful
        await this.updateJobStatus(jobId, 'success', {
          rows_processed: result.rowsProcessed,
          completed_at: result.completedAt.toISOString(),
        });

        // Update model's last_refresh_at timestamp
        await this.updateModelRefreshTimestamp(modelId);
      } else {
        // Update job as failed
        await this.updateJobStatus(jobId, 'error', {
          error_message: result.error || 'Unknown error',
          completed_at: result.completedAt.toISOString(),
        });
      }
    } catch (error) {
      console.error('Job processing error:', error);
      
      // Update job as failed
      await this.updateJobStatus(jobId, 'error', {
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      });
    }
  }

  /**
   * Get model definition from database
   */
  private async getModel(modelId: string, orgId: string): Promise<ModelDefinition | null> {
    const { data, error } = await this.supabase
      .from('models_catalog')
      .select('*')
      .eq('id', modelId)
      .eq('org_id', orgId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      org_id: data.org_id,
      name: data.name,
      sql_definition: data.sql_definition || '',
      primary_date_column: data.primary_date_column || 'date_value',
      dimension_columns: data.dimension_columns || [],
      measure_columns: data.measure_columns || [],
      date_grain: data.date_grain || 'day',
    };
  }

  /**
   * Update job status in database
   */
  private async updateJobStatus(
    jobId: string,
    status: 'pending' | 'running' | 'success' | 'error',
    updates: Record<string, any> = {}
  ): Promise<void> {
    const { error } = await this.supabase
      .from('model_refresh_jobs')
      .update({
        status,
        ...updates,
      })
      .eq('id', jobId);

    if (error) {
      console.error('Failed to update job status:', error);
    }
  }

  /**
   * Update model's last refresh timestamp
   */
  private async updateModelRefreshTimestamp(modelId: string): Promise<void> {
    const { error } = await this.supabase
      .from('models_catalog')
      .update({
        last_refresh_at: new Date().toISOString(),
      })
      .eq('id', modelId);

    if (error) {
      console.error('Failed to update model refresh timestamp:', error);
    }
  }

  /**
   * Create a new refresh job
   */
  async createJob(
    modelId: string,
    orgId: string,
    options: {
      incremental?: boolean;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('model_refresh_jobs')
      .insert({
        model_id: modelId,
        org_id: orgId,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error('Failed to create refresh job');
    }

    return data.id;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<{
    status: 'pending' | 'running' | 'success' | 'error';
    rows_processed?: number;
    error_message?: string;
    started_at?: string;
    completed_at?: string;
  } | null> {
    const { data, error } = await this.supabase
      .from('model_refresh_jobs')
      .select('status, rows_processed, error_message, started_at, completed_at')
      .eq('id', jobId)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  }
}

// Singleton instance
let refreshWorker: ModelRefreshWorker | null = null;

export function getRefreshWorker(): ModelRefreshWorker {
  if (!refreshWorker) {
    refreshWorker = new ModelRefreshWorker();
  }
  return refreshWorker;
}

