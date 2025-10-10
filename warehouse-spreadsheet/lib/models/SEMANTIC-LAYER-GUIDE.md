# Semantic Layer Setup Guide

This guide explains how to set up and use the Snowflake-backed semantic layer for your workbooks.

## Overview

The semantic layer provides a flexible way to define data models and metrics that can be used across multiple workbooks:

1. **Models** - SQL queries that materialize data at the finest grain (daily with dimensions)
2. **Metrics** - Calculated measures from models (sum, count, avg, etc.)
3. **Materialization** - Models are executed against Snowflake and cached in Supabase
4. **Aggregation** - Metrics are aggregated from materialized data to any time grain

## Quick Start

### 1. Run Database Migrations

First, apply the semantic layer schema:

```bash
# Apply the migration using your Supabase CLI or run the SQL directly
psql $DATABASE_URL < supabase/migrations/002_semantic_layer.sql
```

### 2. Create Your First Model

Create a model definition with SQL:

```typescript
// Example: New users model
const newUsersModel = {
  name: 'new_users',
  description: 'New user signups by day and channel',
  sql: `
    SELECT 
      DATE(created_at) as created_dt,
      channel,
      region,
      COUNT(DISTINCT user_id) as new_users,
      SUM(initial_value) as signup_revenue
    FROM raw.users
    WHERE created_at >= '2024-01-01'
    GROUP BY DATE(created_at), channel, region
    ORDER BY created_dt
  `,
  primary_date_column: 'created_dt',
  date_grain: 'day',
  dimension_columns: ['channel', 'region'],
  measure_columns: ['new_users', 'signup_revenue'],
}
```

### 3. Insert Model into Database

Use the API or directly insert into `models_catalog`:

```typescript
import { getServerSupabaseClient } from '@/lib/supabase/client'

const supabase = getServerSupabaseClient()

await supabase.from('models_catalog').insert({
  org_id: 'default_org',
  name: 'new_users',
  database: 'ANALYTICS',
  schema: 'PUBLIC',
  model_type: 'view',
  sql_definition: newUsersModel.sql,
  primary_date_column: 'created_dt',
  date_grain: 'day',
  dimension_columns: ['channel', 'region'],
  measure_columns: ['new_users', 'signup_revenue'],
})
```

### 4. Materialize the Model

Trigger materialization to execute the SQL and cache results:

```bash
curl -X POST http://localhost:3000/api/models/refresh \
  -H "Content-Type: application/json" \
  -d '{"modelId": "YOUR_MODEL_ID"}'
```

Or use the UI:
1. Go to `/models`
2. Select your model
3. Click "Refresh" button

### 5. Create Metrics from the Model

Define metrics that aggregate model measures:

```typescript
await supabase.from('metrics').insert([
  {
    org_id: 'default_org',
    model_id: 'YOUR_MODEL_ID',
    name: 'new_users',
    display_name: 'New Users',
    description: 'Count of new user signups',
    measure_column: 'new_users',
    aggregation: 'sum',
    format_type: 'number',
  },
  {
    org_id: 'default_org',
    model_id: 'YOUR_MODEL_ID',
    name: 'paid_signups',
    display_name: 'Paid Signups',
    description: 'New users from paid channels',
    measure_column: 'new_users',
    aggregation: 'sum',
    format_type: 'number',
    filters: [
      { column: 'channel', operator: 'in', value: ['google', 'facebook', 'linkedin'] }
    ],
  },
])
```

### 6. Use Metrics in Workbooks

In spreadsheet cells, reference metrics using formulas:

```
=new_users  // Uses column header for time period
=new_users(channel='paid')  // Filter by dimension
=paid_signups  // Uses metric-level filter
```

## Model Requirements

### SQL Query Structure

Models must return:
- **One date column** - The primary date for time-based filtering
- **Zero or more dimension columns** - For filtering/grouping (channel, region, product, etc.)
- **One or more measure columns** - Numeric values to aggregate

Example:
```sql
SELECT 
  DATE(created_at) as created_dt,     -- Required date column
  channel,                             -- Dimension
  region,                              -- Dimension  
  COUNT(DISTINCT user_id) as new_users,-- Measure
  SUM(revenue) as revenue              -- Measure
FROM raw.users
WHERE created_at >= '2024-01-01'
GROUP BY DATE(created_at), channel, region
```

### Best Practices

1. **Use the finest grain** - Always materialize at daily level, even if you only need monthly
2. **Include all dimensions** - Add any columns you might filter by
3. **Pre-calculate measures** - Do aggregations in the SQL, not in metrics
4. **Filter at source** - Use WHERE clauses to limit data range
5. **Order by date** - Makes materialization more efficient

## Aggregation Logic

When a workbook requests a metric, the system:

1. Loads materialized data for the model from Supabase
2. Filters by date range (from column header: Q1 2024, etc.)
3. Applies dimension filters (from formula arguments)
4. Aggregates the measure column using the specified aggregation

Example: `=new_users` in a Q1 2024 column:
```sql
-- Behind the scenes:
SELECT SUM(new_users) 
FROM materialized_model_data
WHERE model_id = 'new_users_model'
  AND date_value >= '2024-01-01'
  AND date_value < '2024-04-01'
```

Example: `=new_users(channel='paid')` in a Q1 2024 column:
```sql
-- Behind the scenes:
SELECT SUM(new_users)
FROM materialized_model_data
WHERE model_id = 'new_users_model'
  AND date_value >= '2024-01-01'
  AND date_value < '2024-04-01'
  AND dimensions->>'channel' = 'paid'
```

## Refresh Strategies

### Full Refresh
Clears all materialized data and re-executes the entire SQL query:

```bash
curl -X POST /api/models/refresh \
  -d '{"modelId": "MODEL_ID"}'
```

### Incremental Refresh
Only refreshes data for a specific date range:

```bash
curl -X POST /api/models/refresh \
  -d '{
    "modelId": "MODEL_ID",
    "incremental": true,
    "startDate": "2024-10-01",
    "endDate": "2024-10-11"
  }'
```

### Scheduled Refresh
Set a cron schedule in the `models_catalog.refresh_schedule` column:

```sql
UPDATE models_catalog
SET refresh_schedule = '0 */6 * * *'  -- Every 6 hours
WHERE id = 'MODEL_ID';
```

## Troubleshooting

### Model won't materialize
- Check Snowflake credentials in `.env.local`
- Verify SQL runs in Snowflake SQL Console
- Check logs for error messages
- Ensure required columns are in SELECT

### Metrics return 0
- Verify model is materialized (check `materialized_rows` > 0)
- Check date range includes data
- Verify measure column name matches metric definition
- Check dimension filters aren't too restrictive

### Slow queries
- Add indexes to `materialized_model_data` (already included in migration)
- Limit date range in model SQL
- Reduce number of dimensions
- Use incremental refresh instead of full

## API Reference

### POST /api/models/refresh
Trigger model materialization

**Body:**
```json
{
  "modelId": "uuid",
  "incremental": false,
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

### GET /api/jobs/:jobId
Check refresh job status

**Response:**
```json
{
  "jobId": "uuid",
  "status": "success|running|error",
  "rows_processed": 12345,
  "started_at": "2024-10-10T12:00:00Z",
  "completed_at": "2024-10-10T12:05:00Z"
}
```

### POST /api/metrics
Evaluate a metric

**Body:**
```json
{
  "metricName": "new_users",
  "grain": "quarter",
  "startDate": "2024-01-01",
  "endDate": "2024-04-01",
  "dimensions": {
    "channel": "paid"
  }
}
```

### GET /api/catalog
List all models with stats

**Response:**
```json
{
  "catalog": [
    {
      "id": "uuid",
      "name": "new_users",
      "description": "...",
      "materialized_rows": 12345,
      "date_range": {
        "min": "2024-01-01",
        "max": "2024-10-10"
      },
      "last_refresh_at": "2024-10-10T12:00:00Z"
    }
  ]
}
```

## Examples

See `lib/models/example-models.ts` for complete examples including:
- New users model with channel dimension
- Revenue model with product and region
- Marketing spend model with campaign tracking

