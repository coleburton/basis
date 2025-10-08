/**
 * EXAMPLE USAGE - How the Semantic Layer Works
 *
 * This file demonstrates how your "users" metric would work
 * in a quarterly 2024 workbook with the semantic layer.
 *
 * NO NEED TO RUN THIS - Just for documentation/understanding
 */

import { getModel, getMetric } from './registry';
import { getQueryBuilder, type QueryContext } from './query-builder';

// =============================================================================
// SCENARIO: Quarterly 2024 Workbook with Users Metric
// =============================================================================

function exampleQuarterlyWorkbook() {
  console.log('=== Example: Quarterly 2024 Workbook ===\n');

  // Step 1: Get the metric definition
  // When user types =METRIC("new_users") in cell B2
  const metric = getMetric('new_users', 'default');
  if (!metric) throw new Error('Metric not found');

  // Step 2: Get the model for this metric
  const model = getModel('users', 'default');
  if (!model) throw new Error('Model not found');

  console.log('Metric:', metric.display_name);
  console.log('Model:', model.name);
  console.log('Source:', `${model.database}.${model.schema}.${model.table}`);
  console.log('Date Column:', model.primary_date_column);
  console.log('');

  // Step 3: The cell knows its context from the column header
  // Column B = "Q1 2024"
  const q1Context: QueryContext = {
    grain: 'quarter',
    startDate: '2024-01-01', // Q1 starts Jan 1
    endDate: '2024-04-01', // Q1 ends Mar 31 (exclusive end)
  };

  // Step 4: Build the SQL query for Q1 2024
  const queryBuilder = getQueryBuilder();
  const q1Query = queryBuilder.buildMetricQuery(model, metric, q1Context);

  console.log('Q1 2024 Query:');
  console.log(q1Query);
  console.log('');

  // Step 5: Same formula in different columns = different queries
  // Column C = "Q2 2024"
  const q2Context: QueryContext = {
    grain: 'quarter',
    startDate: '2024-04-01',
    endDate: '2024-07-01',
  };

  const q2Query = queryBuilder.buildMetricQuery(model, metric, q2Context);

  console.log('Q2 2024 Query:');
  console.log(q2Query);
  console.log('');

  // The workbook automatically:
  // 1. Detects the grain (quarterly) from column headers
  // 2. Calculates the date range for each quarter
  // 3. Builds the appropriate SQL query
  // 4. Executes against Snowflake
  // 5. Returns the aggregated value
}

// =============================================================================
// SCENARIO 2: Same Workbook, But with Global Filters
// =============================================================================

function exampleWithGlobalFilters() {
  console.log('=== Example: With Global Filters (2024 Only, Active Users) ===\n');

  // If your workbook has a data connection with global filters
  // These filters apply to ALL metrics from this model
  const context: QueryContext = {
    grain: 'quarter',
    startDate: '2024-01-01',
    endDate: '2024-04-01',

    // Global filter: Only 2024 data (redundant with dates, but for example)
    globalFilters: {
      // Any additional filters from your workbook connection
      // For example, if you only want certain user types
      // user_type: 'premium',
    },
  };

  const metric = getMetric('active_users', 'default'); // Note: different metric with filter
  const model = getModel('users', 'default');

  if (!metric || !model) throw new Error('Not found');

  const queryBuilder = getQueryBuilder();
  const query = queryBuilder.buildMetricQuery(model, metric, context);

  console.log('Active Users Q1 2024 Query:');
  console.log(query);
  console.log('');
  console.log('Notice: This metric has a built-in filter for status = \'active\'');
  console.log('This filter is ALWAYS applied when using the active_users metric');
}

// =============================================================================
// SCENARIO 3: Monthly Granularity
// =============================================================================

function exampleMonthlyGranularity() {
  console.log('=== Example: Monthly Granularity ===\n');

  // If your workbook has monthly columns instead of quarterly
  // Column B = "Jan 2024", Column C = "Feb 2024", etc.

  const janContext: QueryContext = {
    grain: 'month',
    startDate: '2024-01-01',
    endDate: '2024-02-01', // Jan is Jan 1 - Jan 31 (exclusive end)
  };

  const metric = getMetric('new_users', 'default');
  const model = getModel('users', 'default');

  if (!metric || !model) throw new Error('Not found');

  const queryBuilder = getQueryBuilder();
  const janQuery = queryBuilder.buildMetricQuery(model, metric, janContext);

  console.log('January 2024 Query:');
  console.log(janQuery);
  console.log('');
  console.log('Same metric, different granularity - automatically handled!');
}

// =============================================================================
// Run Examples (only if executed directly)
// =============================================================================

if (require.main === module) {
  exampleQuarterlyWorkbook();
  console.log('\n' + '='.repeat(70) + '\n');

  exampleWithGlobalFilters();
  console.log('\n' + '='.repeat(70) + '\n');

  exampleMonthlyGranularity();
}

export {
  exampleQuarterlyWorkbook,
  exampleWithGlobalFilters,
  exampleMonthlyGranularity,
};
