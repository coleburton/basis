# Snowflake Semantic Layer - Setup & Testing Guide

This guide will walk you through setting up and testing the new Snowflake-backed semantic layer.

## Prerequisites

✅ Snowflake credentials added to `.env.local`
✅ Supabase database configured
✅ Node.js and npm installed

## Step 1: Apply Database Migration

Apply the new schema for the semantic layer:

```bash
# Option A: Using Supabase CLI
supabase db push

# Option B: Run SQL directly in Supabase dashboard
# Go to SQL Editor and run: supabase/migrations/002_semantic_layer.sql
```

This creates:
- `metrics` table - stores metric definitions
- `materialized_model_data` table - stores materialized model results
- `model_refresh_jobs` table - tracks refresh operations
- Updates to `models_catalog` table - adds materialization fields

## Step 2: Create Your First Model

There are two ways to create models:

### Option A: Create in Database Directly

Use the Supabase SQL Editor or your favorite SQL client:

```sql
-- Example: Revenue model
INSERT INTO models_catalog (
  org_id,
  name,
  database,
  schema,
  model_type,
  sql_definition,
  primary_date_column,
  date_grain,
  dimension_columns,
  measure_columns
) VALUES (
  'default_org',
  'revenue',
  'ANALYTICS',
  'PUBLIC',
  'view',
  'SELECT 
    DATE(order_date) as order_dt,
    product,
    region,
    status,
    COUNT(DISTINCT order_id) as orders,
    SUM(amount) as revenue,
    AVG(amount) as avg_order_value
  FROM raw.orders
  WHERE order_date >= ''2024-01-01''
    AND status = ''completed''
  GROUP BY DATE(order_date), product, region, status
  ORDER BY order_dt',
  'order_dt',
  'day',
  ARRAY['product', 'region', 'status'],
  ARRAY['orders', 'revenue', 'avg_order_value']
);
```

### Option B: Use Helper Functions

Use the provided helper functions in code:

```typescript
import { createModelFromDefinition } from '@/lib/models/example-models';
import { getServerSupabaseClient } from '@/lib/supabase/client';
import { EXAMPLE_MODELS } from '@/lib/models/example-models';

const supabase = getServerSupabaseClient();
const modelId = await createModelFromDefinition(
  supabase,
  'default_org',
  EXAMPLE_MODELS.revenue
);
```

## Step 3: Materialize the Model

Trigger the materialization process to execute the SQL and cache results:

### Via API:

```bash
# Get the model ID first (from database or API)
curl -X GET http://localhost:3000/api/catalog

# Trigger refresh
curl -X POST http://localhost:3000/api/models/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "modelId": "YOUR_MODEL_ID"
  }'

# Check job status
curl http://localhost:3000/api/jobs/JOB_ID
```

### Via UI:

1. Navigate to http://localhost:3000/models
2. Select your model from the list
3. Click the "Refresh" button
4. Wait for completion (you'll see a spinner)

## Step 4: Create Metrics

Create metrics that use your model's measures:

```sql
INSERT INTO metrics (
  org_id,
  model_id,
  name,
  display_name,
  description,
  measure_column,
  aggregation,
  format_type
) VALUES 
(
  'default_org',
  'YOUR_MODEL_ID',
  'total_revenue',
  'Total Revenue',
  'Sum of all completed orders',
  'revenue',
  'sum',
  'currency'
),
(
  'default_org',
  'YOUR_MODEL_ID',
  'order_count',
  'Order Count',
  'Number of completed orders',
  'orders',
  'sum',
  'number'
);
```

## Step 5: Test the Metrics

Query a metric value for a specific time period:

```bash
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "total_revenue",
    "grain": "quarter",
    "startDate": "2024-01-01",
    "endDate": "2024-04-01"
  }'
```

With dimension filters:

```bash
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "total_revenue",
    "grain": "quarter",
    "startDate": "2024-01-01",
    "endDate": "2024-04-01",
    "dimensions": {
      "region": "US",
      "product": "premium"
    }
  }'
```

## Step 6: Use in Workbooks

In your spreadsheet cells, you can now use metrics:

```
Cell A1: Q1 2024 (column header with date)
Cell B1: =total_revenue

Cell A2: Q2 2024
Cell B2: =total_revenue(region='US')

Cell A3: Q3 2024
Cell B3: =total_revenue(region='EU', product='basic')
```

The system will:
1. Parse the column header to get the date range (Q1 2024 → 2024-01-01 to 2024-04-01)
2. Look up the metric definition
3. Query the materialized model data
4. Filter by date range and dimensions
5. Aggregate the measure column
6. Return the value

## Testing Checklist

### ✅ Database Schema
- [ ] Migration applied successfully
- [ ] Tables created: `metrics`, `materialized_model_data`, `model_refresh_jobs`
- [ ] `models_catalog` has new columns

### ✅ Model Creation
- [ ] Model inserted into `models_catalog`
- [ ] SQL definition is valid Snowflake SQL
- [ ] Date column, dimensions, and measures specified

### ✅ Materialization
- [ ] Refresh job created
- [ ] Job status changes from `pending` → `running` → `success`
- [ ] Data inserted into `materialized_model_data`
- [ ] `models_catalog.last_refresh_at` updated

### ✅ Metrics
- [ ] Metrics created in `metrics` table
- [ ] Metrics reference valid model_id
- [ ] Measure columns exist in materialized data

### ✅ API Endpoints
- [ ] `GET /api/catalog` returns models with stats
- [ ] `POST /api/models/refresh` triggers refresh
- [ ] `GET /api/jobs/:jobId` returns status
- [ ] `POST /api/metrics` returns metric values
- [ ] `GET /api/metrics` lists all metrics

### ✅ UI
- [ ] Model catalog page loads (`/models`)
- [ ] Models display with materialization stats
- [ ] Refresh button works
- [ ] SQL definition displays
- [ ] Dimensions and measures shown

## Troubleshooting

### Snowflake Connection Errors

```
Error: Failed to connect to Snowflake
```

**Solution:** Check `.env.local` has all required variables:
```
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USER=your_user
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_WAREHOUSE=your_warehouse
SNOWFLAKE_ROLE=your_role
```

### Materialization Fails

```
Error: Model output missing required date column
```

**Solution:** Ensure your SQL query returns a column with the name specified in `primary_date_column`.

### No Data Returned

```
{"value": 0, "rows_scanned": 0}
```

**Solution:** 
1. Check model has materialized data: `SELECT COUNT(*) FROM materialized_model_data WHERE model_id = 'YOUR_ID'`
2. Verify date range overlaps with materialized data
3. Check dimension filters aren't too restrictive

### Job Stuck in "running"

**Solution:**
1. Check logs for errors
2. Check Snowflake query history
3. Kill the job and try again:
   ```sql
   UPDATE model_refresh_jobs 
   SET status = 'error', error_message = 'Manual cancellation'
   WHERE id = 'JOB_ID';
   ```

## Example: Complete Workflow

Here's a complete example from scratch:

### 1. Create Model SQL

```sql
INSERT INTO models_catalog (
  org_id, name, database, schema, model_type,
  sql_definition, primary_date_column, date_grain,
  dimension_columns, measure_columns
) VALUES (
  'default_org',
  'new_users',
  'ANALYTICS',
  'PUBLIC',
  'view',
  'SELECT 
    DATE(created_at) as created_dt,
    channel,
    country,
    COUNT(DISTINCT user_id) as new_users,
    SUM(initial_purchase) as signup_revenue
  FROM raw.users
  WHERE created_at >= ''2024-01-01''
  GROUP BY DATE(created_at), channel, country',
  'created_dt',
  'day',
  ARRAY['channel', 'country'],
  ARRAY['new_users', 'signup_revenue']
) RETURNING id;
-- Save this ID!
```

### 2. Materialize

```bash
curl -X POST http://localhost:3000/api/models/refresh \
  -H "Content-Type: application/json" \
  -d '{"modelId": "MODEL_ID_FROM_STEP_1"}'
```

### 3. Create Metrics

```sql
INSERT INTO metrics (
  org_id, model_id, name, display_name,
  measure_column, aggregation, format_type
) VALUES 
('default_org', 'MODEL_ID', 'new_users', 'New Users', 'new_users', 'sum', 'number'),
('default_org', 'MODEL_ID', 'signup_revenue', 'Signup Revenue', 'signup_revenue', 'sum', 'currency');
```

### 4. Query Metrics

```bash
# Total new users in Q1 2024
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "new_users",
    "grain": "quarter",
    "startDate": "2024-01-01",
    "endDate": "2024-04-01"
  }'

# New users from Google in US
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "new_users",
    "grain": "quarter",
    "startDate": "2024-01-01",
    "endDate": "2024-04-01",
    "dimensions": {
      "channel": "google",
      "country": "US"
    }
  }'
```

## Next Steps

1. **Set up scheduled refreshes** - Add cron schedules to models
2. **Create more models** - Build out your semantic layer
3. **Add metrics** - Define all your key business metrics
4. **Use in workbooks** - Start building analyses with the metrics
5. **Monitor performance** - Watch materialized data size and query times

## Additional Resources

- [Semantic Layer Guide](./lib/models/SEMANTIC-LAYER-GUIDE.md) - Detailed architecture docs
- [Example Models](./lib/models/example-models.ts) - Pre-built model templates
- [Query Builder](./lib/models/query-builder.ts) - SQL generation reference

## Support

If you run into issues:
1. Check the logs in your terminal/console
2. Review the troubleshooting section above
3. Check Snowflake query history for SQL errors
4. Inspect Supabase tables directly to debug data flow

