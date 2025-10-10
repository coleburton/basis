/**
 * MaterializationEngine
 * 
 * Executes model SQL against Snowflake and materializes the results
 * into Supabase for fast querying across multiple workbooks.
 */

import { getSnowflakeClient } from '@/lib/snowflake/client';
import { getServerSupabaseClient } from '@/lib/supabase/client';

export interface ModelDefinition {
  id: string;
  org_id: string;
  name: string;
  sql_definition: string;
  primary_date_column: string;
  dimension_columns: string[];
  measure_columns: string[];
  date_grain: 'day' | 'hour';
}

export interface MaterializationResult {
  success: boolean;
  rowsProcessed: number;
  error?: string;
  startedAt: Date;
  completedAt: Date;
}

export class MaterializationEngine {
  private snowflake = getSnowflakeClient();
  private supabase = getServerSupabaseClient();

  /**
   * Materialize a model by executing its SQL and storing results
   */
  async materialize(
    model: ModelDefinition,
    options: {
      incremental?: boolean;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<MaterializationResult> {
    const startedAt = new Date();
    
    try {
      console.log(`[Materialization] Starting refresh for model: ${model.name}`);
      console.log(`[Materialization] Options:`, options);
      
      // Build the SQL query
      let sql = model.sql_definition;
      
      // For incremental refresh, add date filter
      if (options.incremental && options.startDate) {
        console.log(`[Materialization] Adding incremental date filter: >= ${options.startDate}`);
        // Check if SQL already has a WHERE clause
        const hasWhere = /WHERE/i.test(sql);
        const dateFilter = `${model.primary_date_column} >= '${options.startDate}'`;
        
        if (hasWhere) {
          sql = sql.replace(/WHERE/i, `WHERE ${dateFilter} AND`);
        } else {
          // Add WHERE clause before GROUP BY or ORDER BY
          sql = sql.replace(
            /(GROUP\s+BY|ORDER\s+BY)/i,
            `WHERE ${dateFilter}\n$1`
          );
        }
      }

      if (options.endDate) {
        console.log(`[Materialization] Adding end date filter: < ${options.endDate}`);
        const hasWhere = /WHERE/i.test(sql);
        const dateFilter = `${model.primary_date_column} < '${options.endDate}'`;
        
        if (hasWhere) {
          sql = sql.replace(/WHERE/i, `WHERE ${dateFilter} AND`);
        } else {
          sql = sql.replace(
            /(GROUP\s+BY|ORDER\s+BY)/i,
            `WHERE ${dateFilter}\n$1`
          );
        }
      }

      // Execute query against Snowflake
      console.log(`[Materialization] Executing SQL query...`);
      console.log(`[Materialization] SQL:\n${sql}`);
      
      const result = await this.snowflake.execute<Record<string, any>>(sql);
      console.log(`[Materialization] Query returned ${result.rows.length} rows`);

      // Validate results
      console.log(`[Materialization] Validating results...`);
      this.validateResults(result.rows, model);

      // Clear old data if doing full refresh
      if (!options.incremental) {
        console.log(`[Materialization] Clearing all existing data for full refresh...`);
        await this.clearMaterializedData(model.id);
      } else if (options.startDate) {
        // Clear data in the refresh range
        console.log(`[Materialization] Clearing date range for incremental refresh...`);
        await this.clearDateRange(model.id, options.startDate, options.endDate);
      }

      // Insert new data
      console.log(`[Materialization] Inserting materialized data...`);
      await this.insertMaterializedData(model, result.rows);

      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      console.log(`[Materialization] ✅ Completed successfully in ${durationMs}ms`);
      
      return {
        success: true,
        rowsProcessed: result.rows.length,
        startedAt,
        completedAt,
      };
    } catch (error) {
      const completedAt = new Date();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Materialization] ❌ Failed:`, errorMessage);
      console.error(`[Materialization] Full error:`, error);
      
      return {
        success: false,
        rowsProcessed: 0,
        error: errorMessage,
        startedAt,
        completedAt,
      };
    }
  }

  /**
   * Validate that query results match expected schema
   */
  private validateResults(rows: Record<string, any>[], model: ModelDefinition): void {
    if (rows.length === 0) {
      console.warn(`[Materialization] Model ${model.name} returned no rows`);
      return;
    }

    const firstRow = rows[0];
    const columns = Object.keys(firstRow);
    
    // Create lowercase map for case-insensitive matching
    const columnsLowerCase = columns.map(c => c.toLowerCase());
    
    console.log(`[Materialization] Query returned columns:`, columns);
    console.log(`[Materialization] Expected date column: ${model.primary_date_column}`);
    console.log(`[Materialization] Expected measures: ${model.measure_columns.join(', ')}`);
    console.log(`[Materialization] Expected dimensions: ${model.dimension_columns.join(', ')}`);

    // Check for date column (case-insensitive)
    const dateColLower = model.primary_date_column.toLowerCase();
    if (!columnsLowerCase.includes(dateColLower)) {
      throw new Error(
        `Model output missing required date column: ${model.primary_date_column}. ` +
        `Available columns: ${columns.join(', ')}`
      );
    }

    // Check for measure columns (case-insensitive)
    for (const measureCol of model.measure_columns) {
      const measureColLower = measureCol.toLowerCase();
      if (!columnsLowerCase.includes(measureColLower)) {
        throw new Error(
          `Model output missing measure column: ${measureCol}. ` +
          `Available columns: ${columns.join(', ')}`
        );
      }
    }

    // Dimension columns are optional but should exist if specified
    for (const dimCol of model.dimension_columns) {
      const dimColLower = dimCol.toLowerCase();
      if (!columnsLowerCase.includes(dimColLower)) {
        console.warn(`[Materialization] ⚠️ Model output missing dimension column: ${dimCol}. Available: ${columns.join(', ')}`);
      }
    }
    
    console.log('[Materialization] ✅ Schema validation passed');
  }

  /**
   * Clear all materialized data for a model
   */
  private async clearMaterializedData(modelId: string): Promise<void> {
    const { error } = await this.supabase
      .from('materialized_model_data')
      .delete()
      .eq('model_id', modelId);

    if (error) {
      throw new Error(`Failed to clear materialized data: ${error.message}`);
    }
  }

  /**
   * Clear materialized data for a specific date range
   */
  private async clearDateRange(
    modelId: string,
    startDate: string,
    endDate?: string
  ): Promise<void> {
    let query = this.supabase
      .from('materialized_model_data')
      .delete()
      .eq('model_id', modelId)
      .gte('date_value', startDate);

    if (endDate) {
      query = query.lt('date_value', endDate);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Failed to clear date range: ${error.message}`);
    }
  }

  /**
   * Insert materialized data into Supabase
   */
  private async insertMaterializedData(
    model: ModelDefinition,
    rows: Record<string, any>[]
  ): Promise<void> {
    // Create a helper function to find column case-insensitively
    const findColumn = (row: Record<string, any>, columnName: string): any => {
      // First try exact match
      if (row[columnName] !== undefined) {
        return row[columnName];
      }
      
      // Try case-insensitive match
      const lowerColumnName = columnName.toLowerCase();
      const actualKey = Object.keys(row).find(k => k.toLowerCase() === lowerColumnName);
      return actualKey ? row[actualKey] : undefined;
    };

    // Transform rows into materialized format
    const materializedRows = rows.map(row => {
      // Extract date value (case-insensitive)
      const dateValue = this.parseDateValue(findColumn(row, model.primary_date_column));

      // Extract dimensions (all non-date, non-measure columns)
      const dimensions: Record<string, any> = {};
      for (const dimCol of model.dimension_columns) {
        const value = findColumn(row, dimCol);
        if (value !== undefined) {
          dimensions[dimCol.toLowerCase()] = value; // Normalize to lowercase
        }
      }

      // Extract measures
      const measures: Record<string, any> = {};
      for (const measureCol of model.measure_columns) {
        const value = findColumn(row, measureCol);
        if (value !== undefined) {
          measures[measureCol.toLowerCase()] = value; // Normalize to lowercase
        }
      }

      return {
        model_id: model.id,
        date_value: dateValue,
        dimensions: Object.keys(dimensions).length > 0 ? dimensions : null,
        measures,
      };
    });

    // Insert in batches to avoid payload size limits
    const batchSize = 1000;
    for (let i = 0; i < materializedRows.length; i += batchSize) {
      const batch = materializedRows.slice(i, i + batchSize);
      
      const { error } = await this.supabase
        .from('materialized_model_data')
        .insert(batch);

      if (error) {
        throw new Error(`Failed to insert batch: ${error.message}`);
      }

      console.log(`[Materialization] Inserted batch ${i / batchSize + 1} of ${Math.ceil(materializedRows.length / batchSize)}`);
    }
  }

  /**
   * Parse date value from various formats
   */
  private parseDateValue(value: any): string {
    if (typeof value === 'string') {
      // Already a string, extract just the date part (YYYY-MM-DD)
      return value.split('T')[0];
    }
    
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }

    // Try to parse as date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }

    throw new Error(`Invalid date value: ${value}`);
  }

  /**
   * Get materialization statistics for a model
   */
  async getStats(modelId: string): Promise<{
    totalRows: number;
    dateRange: { min: string; max: string } | null;
    lastRefresh: string | null;
  }> {
    // Get row count
    const { count, error: countError } = await this.supabase
      .from('materialized_model_data')
      .select('*', { count: 'exact', head: true })
      .eq('model_id', modelId);

    if (countError) {
      throw new Error(`Failed to get row count: ${countError.message}`);
    }

    // Get date range
    const { data: dateData, error: dateError } = await this.supabase
      .from('materialized_model_data')
      .select('date_value')
      .eq('model_id', modelId)
      .order('date_value', { ascending: true })
      .limit(1);

    const { data: maxDateData, error: maxDateError } = await this.supabase
      .from('materialized_model_data')
      .select('date_value')
      .eq('model_id', modelId)
      .order('date_value', { ascending: false })
      .limit(1);

    let dateRange = null;
    if (!dateError && !maxDateError && dateData && maxDateData && dateData.length > 0 && maxDateData.length > 0) {
      dateRange = {
        min: dateData[0].date_value,
        max: maxDateData[0].date_value,
      };
    }

    // Get last refresh
    const { data: modelData, error: modelError } = await this.supabase
      .from('models_catalog')
      .select('last_refresh_at')
      .eq('id', modelId)
      .single();

    const lastRefresh = !modelError && modelData ? modelData.last_refresh_at : null;

    return {
      totalRows: count || 0,
      dateRange,
      lastRefresh,
    };
  }
}

// Singleton instance
let materializationEngine: MaterializationEngine | null = null;

export function getMaterializationEngine(): MaterializationEngine {
  if (!materializationEngine) {
    materializationEngine = new MaterializationEngine();
  }
  return materializationEngine;
}

