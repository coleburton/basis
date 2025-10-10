# Quick Start - Get Running in 5 Minutes

The fastest way to get your Snowflake semantic layer up and running.

## Prerequisites

✅ `.env.local` file with Snowflake credentials
✅ Supabase database configured
✅ Dev server running (`npm run dev`)

## Step 1: Apply Database Migration (1 min)

Run the SQL migration in your Supabase SQL editor:

```bash
# Copy the contents of this file and run in Supabase:
cat supabase/migrations/002_semantic_layer.sql
```

Or if using Supabase CLI:
```bash
supabase db push
```

## Step 2: Create Example Model (30 seconds)

Use the quick setup endpoint to create a pre-built example:

```bash
# List available examples
curl http://localhost:3000/api/setup-example

# Create the "new_users" example model
curl -X POST http://localhost:3000/api/setup-example \
  -H "Content-Type: application/json" \
  -d '{"model": "new_users"}'

# Save the modelId from the response!
```

This creates:
- ✅ A model with SQL definition
- ✅ Example metrics (new_users, signup_revenue)
- ✅ Instructions for next steps

## Step 3: Materialize the Model (2-3 min)

Trigger the refresh to pull data from Snowflake:

```bash
# Replace MODEL_ID with the ID from step 2
curl -X POST http://localhost:3000/api/models/refresh \
  -H "Content-Type: application/json" \
  -d '{"modelId": "MODEL_ID"}'

# Save the jobId to check status
```

Check job progress:

```bash
# Replace JOB_ID with the ID from the refresh response
curl http://localhost:3000/api/jobs/JOB_ID

# Wait until status is "success"
```

## Step 4: Query Your First Metric (10 seconds)

```bash
# Get new users for Q1 2024
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "new_users",
    "grain": "quarter",
    "startDate": "2024-01-01",
    "endDate": "2024-04-01"
  }'

# Response:
# {
#   "metric": "new_users",
#   "value": 1250,
#   "grain": "quarter",
#   "source": "materialized"
# }
```

With dimension filter:

```bash
# Get new users from paid channels in US
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "new_users",
    "grain": "quarter",
    "startDate": "2024-01-01",
    "endDate": "2024-04-01",
    "dimensions": {
      "channel": "paid",
      "region": "US"
    }
  }'
```

## Step 5: View in UI (30 seconds)

1. Open http://localhost:3000/models
2. Click on "new_users" model
3. See:
   - SQL definition
   - Materialized row count
   - Available dimensions
   - Available measures
   - Last refresh time
4. Click "Refresh" to re-materialize
5. Watch the spinner as it processes

## Done! 🎉

You now have:
- ✅ A working semantic layer
- ✅ Data materialized from Snowflake
- ✅ Metrics you can query
- ✅ UI to manage models

## Next Steps

### Use in Workbooks

In your spreadsheet cells:

```
Row 1: Q1 2024 | Q2 2024 | Q3 2024
Row 2: =new_users | =new_users | =new_users
Row 3: =new_users(channel='paid') | =new_users(channel='paid') | =new_users(channel='paid')
```

### Create Your Own Model

Replace the example SQL with your own:

```sql
INSERT INTO models_catalog (
  org_id, name, database, schema, model_type,
  sql_definition, primary_date_column, date_grain,
  dimension_columns, measure_columns
) VALUES (
  'default_org',
  'your_model_name',
  'YOUR_DATABASE',
  'YOUR_SCHEMA',
  'view',
  'SELECT 
    DATE(your_date_column) as event_dt,
    your_dimension_1,
    your_dimension_2,
    COUNT(*) as row_count,
    SUM(your_measure) as total_measure
  FROM your_table
  WHERE your_date_column >= ''2024-01-01''
  GROUP BY 1, 2, 3',
  'event_dt',
  'day',
  ARRAY['your_dimension_1', 'your_dimension_2'],
  ARRAY['row_count', 'total_measure']
) RETURNING id;
```

### Create Metrics

```sql
INSERT INTO metrics (
  org_id, model_id, name, display_name,
  measure_column, aggregation, format_type
) VALUES (
  'default_org',
  'YOUR_MODEL_ID',
  'your_metric',
  'Your Metric Name',
  'total_measure',
  'sum',
  'number'
);
```

### Refresh and Use

```bash
# Materialize your model
curl -X POST http://localhost:3000/api/models/refresh \
  -H "Content-Type: application/json" \
  -d '{"modelId": "YOUR_MODEL_ID"}'

# Query your metric
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "your_metric",
    "grain": "month",
    "startDate": "2024-01-01",
    "endDate": "2024-02-01"
  }'
```

## Troubleshooting

### "Failed to connect to Snowflake"
Check your `.env.local` has all required variables:
- `SNOWFLAKE_ACCOUNT`
- `SNOWFLAKE_USER`
- `SNOWFLAKE_PASSWORD`
- `SNOWFLAKE_DATABASE`
- `SNOWFLAKE_WAREHOUSE`
- `SNOWFLAKE_ROLE`

### "Model output missing required date column"
Your SQL must return a column with the exact name specified in `primary_date_column`.

### "No data returned"
1. Check model has materialized data in Supabase:
   ```sql
   SELECT COUNT(*) FROM materialized_model_data 
   WHERE model_id = 'YOUR_MODEL_ID';
   ```
2. Verify your date range overlaps with the data
3. Check dimension filters aren't excluding all rows

### "Job stuck in running"
Check Snowflake query history to see if the query is actually running or errored.

## Reference

- [Complete Setup Guide](./SETUP-GUIDE.md) - Detailed instructions
- [Architecture Guide](./lib/models/SEMANTIC-LAYER-GUIDE.md) - How it works
- [Implementation Summary](./IMPLEMENTATION-SUMMARY.md) - What was built

## Example Models Available

```bash
# Get list of pre-built examples
curl http://localhost:3000/api/setup-example

# Available:
# - new_users: User signups by channel and region
# - revenue: Order revenue by product and region  
# - marketing_spend: Ad spend by channel and campaign
```

Choose one, set it up, and start building! 🚀

