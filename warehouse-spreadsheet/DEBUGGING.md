# Debugging Guide

This guide helps you troubleshoot common issues with the Warehouse Sheets application.

## Getting 0 Values for Metrics

If your metrics are showing 0 values, check these things in order:

### 1. Check if the Model Has Been Refreshed

**Problem**: The model exists but hasn't been materialized yet.

**How to Check**:
- Go to Model Catalog page
- Select your model
- Look at "Last refresh" status - if it says "Never", the model hasn't been refreshed

**Fix**:
- Click the "Refresh" button on the Model Catalog page
- Wait for the job to complete (you'll see a success message)
- Check the browser console for detailed logs

### 2. Check Server Console Logs

The system now has detailed logging throughout. Look for these prefixes in your terminal/server logs:

```
[Materialization] - Model refresh operations
[MetricEvaluator] - Metric calculation operations
[Metrics API] - API requests for metrics
```

**What to look for**:
```bash
# Good refresh:
[Materialization] Starting refresh for model: new_users
[Materialization] Query returned 150 rows
[Materialization] ✅ Completed successfully in 2341ms

# Problem - no data found:
[MetricEvaluator] Found 0 rows of materialized data
[MetricEvaluator] ⚠️ No materialized data found! Model may not be refreshed yet.

# Problem - wrong date range:
[MetricEvaluator] Query: model_id=abc123, date >= 2024-01-01, date < 2024-12-31
[MetricEvaluator] Found 0 rows of materialized data
```

### 3. Verify Snowflake Connection

**How to Check**:
```bash
# Check environment variables are set
echo $SNOWFLAKE_ACCOUNT
echo $SNOWFLAKE_USER
echo $SNOWFLAKE_PASSWORD
echo $SNOWFLAKE_DATABASE
echo $SNOWFLAKE_WAREHOUSE
echo $SNOWFLAKE_ROLE
```

**Common Issues**:
- Missing environment variables
- Incorrect credentials
- Role doesn't have permissions on the database/schema

### 4. Verify SQL Query

**How to Check**:
1. Go to Model Catalog
2. Click "Edit" on your model
3. Copy the SQL query
4. Run it directly in Snowflake to verify it returns data

**Common Issues**:
- Date column name doesn't match `primary_date_column` setting
- Measure column names don't match `measure_columns` setting
- Query returns 0 rows (check your WHERE clauses)
- **Case Sensitivity**: Snowflake returns column names in UPPERCASE by default (e.g., `CREATED_DT`), but the system now handles this automatically

**Important**: The system now supports **case-insensitive column matching**. If your SQL uses `date(ROLE_CREATED_ET) created_dt`, and Snowflake returns it as `CREATED_DT`, the system will find it automatically. You'll see this in the logs:

```
[Materialization] Query returned columns: ["CREATED_DT", "CHANNEL", "NEW_USERS"]
[Materialization] Expected date column: created_dt
[Materialization] ✅ Schema validation passed
```

### 5. Check Date Alignment

The metric evaluator queries based on the date range in your workbook headers.

**How to Check** (in browser console):
```
[MetricEvaluator] Date range: 2024-01-01 to 2024-12-31
[MetricEvaluator] Found 0 rows of materialized data
```

**Fix**:
- Ensure your model's SQL includes dates in the range you're querying
- Check that the `primary_date_column` in your model settings matches the actual date column in your SQL

## Model Refresh Failures

### "SQL contains forbidden pattern" Error

**Problem**: SQL validation is blocking your query

**Common Causes**:
- Using DDL statements (CREATE, DROP, ALTER) - only SELECT is allowed
- False positive from column names

**Already Fixed**:
- The system now only blocks actual SQL keywords, not column names like `ROLE_CREATED_ET`

**Current Allowed Statements**:
- SELECT
- SHOW
- DESCRIBE

**Blocked Statements** (for safety):
- CREATE, DROP, ALTER (DDL)
- INSERT, UPDATE, DELETE, MERGE (DML)
- GRANT, REVOKE (security)
- CALL, EXECUTE IMMEDIATE (procedures)

### Timeout Errors

**Problem**: Query takes too long to execute

**Current Settings**:
- Snowflake query timeout: 60 seconds
- Job polling timeout: 2 minutes

**Fix**:
- Optimize your SQL query (add more WHERE filters)
- Use incremental refresh instead of full refresh
- Increase timeout in `lib/snowflake/client.ts` if needed

### Permission Errors

**Problem**: Snowflake role doesn't have access

**How to Check** - Run this in Snowflake:
```sql
-- Check what you can access
SHOW TABLES IN DATABASE your_database;
SHOW SCHEMAS IN DATABASE your_database;

-- Check your current role
SELECT CURRENT_ROLE();
```

**Fix**:
- Ask your Snowflake admin to grant access to your role
- Or use a different role with appropriate permissions

## Debugging Checklist

When something isn't working, follow this checklist:

1. ✅ **Check Browser Console** - Are there any error messages?
2. ✅ **Check Server Logs** - Look for `[Materialization]`, `[MetricEvaluator]`, `[Metrics API]` logs
3. ✅ **Verify Model Exists** - Go to Model Catalog, is your model there?
4. ✅ **Check Refresh Status** - Has the model been refreshed? When was the last refresh?
5. ✅ **Verify Snowflake Connection** - Are environment variables set correctly?
6. ✅ **Test SQL Query** - Does the query work when run directly in Snowflake?
7. ✅ **Check Date Range** - Does your materialized data cover the dates you're querying?
8. ✅ **Verify Column Names** - Do `primary_date_column`, `measure_columns`, and `dimension_columns` match your SQL?

## Getting More Detailed Logs

All major operations now log extensively. To see them:

1. **In Development**:
   ```bash
   npm run dev
   # Watch the terminal for logs
   ```

2. **In Browser Console**:
   - Open DevTools (F12)
   - Go to Console tab
   - Look for `[Metrics API]`, `[MetricEvaluator]` prefixed logs

3. **For API Calls**:
   - Network tab in DevTools
   - Find the failing API call
   - Check Response tab for error details

## Common Error Messages and Fixes

| Error Message | Cause | Fix |
|--------------|-------|-----|
| "No materialized data found! Model may not be refreshed yet" | Model hasn't been materialized | Click "Refresh" on Model Catalog page |
| "Unknown metric: [name]. No model found with this measure" | Metric doesn't exist in any model | Check model's `measure_columns` setting |
| "SQL contains forbidden statement" | Query contains blocked keyword | Only use SELECT queries |
| "Failed to connect to Snowflake" | Missing/incorrect credentials | Check `.env.local` file |
| "Model output missing required date column" | SQL doesn't return the date column (check logs for actual column names returned) | Update SQL or `primary_date_column` setting, or check case sensitivity |
| "Model output missing measure column" | SQL doesn't return the measure (check logs for actual column names returned) | Update SQL or `measure_columns` setting, or check case sensitivity |

## Still Having Issues?

If you're still stuck:

1. Check the full server logs for the complete error stack trace
2. Verify each environment variable is set correctly
3. Test your SQL query directly in Snowflake
4. Check the `materialized_model_data` table in Supabase to see if data was stored
5. Look for any error messages in the `model_refresh_jobs` table

## Testing in Supabase SQL Editor

You can check the state of your data directly:

```sql
-- Check if models exist
SELECT id, name, last_refresh_at, measure_columns, dimension_columns
FROM models_catalog;

-- Check if data is materialized
SELECT COUNT(*), MIN(date_value), MAX(date_value)
FROM materialized_model_data
WHERE model_id = 'YOUR_MODEL_ID';

-- Check refresh job status
SELECT status, rows_processed, error_message, created_at
FROM model_refresh_jobs
ORDER BY created_at DESC
LIMIT 10;

-- See sample materialized data
SELECT date_value, dimensions, measures
FROM materialized_model_data
WHERE model_id = 'YOUR_MODEL_ID'
LIMIT 5;
```

