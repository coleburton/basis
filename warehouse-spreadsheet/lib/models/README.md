# Semantic Layer - Data Models & Metrics

This directory contains the **semantic layer** for your warehouse spreadsheet. Think of it like Power BI's semantic model or Looker's LookML - it's the layer that sits between your spreadsheet formulas and your raw data warehouse.

## 🎯 What Problem Does This Solve?

You want to:
1. Define your Snowflake `users` table as a reusable data source
2. Create metrics like "new_users" that automatically know how to query that table
3. Have your spreadsheet formulas (`=METRIC("new_users")`) automatically:
   - Detect they're in a Q1 2024 column
   - Filter to only Q1 2024 data
   - Aggregate correctly (COUNT, SUM, etc.)
   - Return the right value

**Without this**: You'd have to write custom SQL for every cell, manually managing date ranges and aggregations.

**With this**: You define the model once, and every cell automatically gets the right data based on its context (time period, filters, etc.).

## 📁 File Structure

```
lib/models/
├── README.md           # You are here
├── registry.ts         # Define your models and metrics (start here!)
├── query-builder.ts    # Builds SQL queries from model + context
└── example-usage.ts    # Examples showing how it all works
```

## 🚀 Quick Start

### Step 1: Define Your Model

Open `registry.ts` and add your Snowflake table as a model:

```typescript
export const MODELS_REGISTRY: Record<string, Model> = {
  users: {
    id: 'model_users',
    org_id: 'default', // Your org ID
    name: 'users',
    description: 'User accounts',

    // Snowflake source
    database: 'ANALYTICS',
    schema: 'PUBLIC',
    table: 'USERS',
    model_type: 'table',

    // CRITICAL: The date column for time filtering
    primary_date_column: 'created_at',
    date_column_type: 'timestamp',

    // Metadata
    created_by: 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};
```

### Step 2: Define Your Metrics

Still in `registry.ts`, add metrics based on your model:

```typescript
export const METRICS_REGISTRY: Record<string, MetricDefinition> = {
  new_users: {
    id: 'metric_new_users',
    org_id: 'default',
    model_id: 'model_users', // Links to the model above

    name: 'new_users',
    display_name: 'New Users',
    description: 'Count of new registrations',

    measure_column: 'user_id', // What to count
    aggregation: 'count_distinct', // How to aggregate

    format_type: 'number',

    created_by: 'system',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};
```

### Step 3: Use in Your Spreadsheet

Now in your spreadsheet, when you write `=METRIC("new_users")` in a cell under "Q1 2024", it will automatically:

1. Look up the `new_users` metric
2. Find the `users` model
3. Detect it's in Q1 2024 (from column header)
4. Build and execute this SQL:

```sql
SELECT COUNT(DISTINCT user_id) as value
FROM ANALYTICS.PUBLIC.USERS
WHERE created_at >= '2024-01-01'
  AND created_at < '2024-04-01'
```

5. Return the result!

## 🔧 Advanced Features

### Metric Filters

You can add filters that are **always applied** when using a metric:

```typescript
active_users: {
  // ... other config
  measure_column: 'user_id',
  aggregation: 'count_distinct',

  // Only count users where status = 'active'
  filters: [
    {
      column: 'status',
      operator: 'eq',
      value: 'active',
    },
  ],
}
```

### Workbook Global Filters

When you attach a model to a workbook, you can add global filters that apply to ALL metrics from that model in that workbook:

```typescript
// Future feature - will be in workbook_data_connections table
{
  workbook_id: 'wb_123',
  model_id: 'model_users',
  global_filters: {
    year: 2024,           // Only 2024 data
    user_type: 'premium', // Only premium users
  }
}
```

### Different Time Granularities

The same metric works at any granularity:

| Column Header | Date Range | SQL WHERE Clause |
|--------------|------------|------------------|
| Q1 2024 | Jan 1 - Mar 31 | `created_at >= '2024-01-01' AND created_at < '2024-04-01'` |
| Jan 2024 | Jan 1 - Jan 31 | `created_at >= '2024-01-01' AND created_at < '2024-02-01'` |
| 2024 | Jan 1 - Dec 31 | `created_at >= '2024-01-01' AND created_at < '2025-01-01'` |

No code changes needed - it's automatic based on column headers!

## 📊 How It Works

### 1. Model Definition
- **What**: A semantic definition of a data source (table/view)
- **Why**: Reusable, consistent way to access your data
- **Example**: The `users` table with `created_at` as its time dimension

### 2. Metric Definition
- **What**: A calculated measure from a model
- **Why**: Defines HOW to aggregate (SUM, COUNT, AVG, etc.)
- **Example**: `new_users` = COUNT DISTINCT of `user_id`

### 3. Query Context
- **What**: The cell's environment (time period, filters)
- **Why**: Same formula, different results based on WHERE it is
- **Example**: Cell in "Q1 2024" column knows to filter Jan-Mar 2024

### 4. Query Builder
- **What**: Translates Model + Metric + Context → SQL
- **Why**: Automatic, safe SQL generation
- **Example**: Builds the SELECT statement with proper WHERE clauses

### 5. Execution
- **What**: Runs the SQL on Snowflake
- **Why**: Gets the actual data
- **Example**: Returns 1,250 new users in Q1 2024

## 🎓 Examples

See `example-usage.ts` for detailed examples:

```bash
# Run the examples
npx ts-node lib/models/example-usage.ts
```

This will show you exactly what SQL queries are generated for different scenarios.

## 🔮 Future Enhancements

### Phase 1 (Current)
- ✅ Models and metrics defined in code
- ✅ Context-aware query building
- ✅ Basic filters
- ✅ Single-org support

### Phase 2 (Multi-tenant)
- [ ] Store models in database per-org
- [ ] UI for defining models (no code required!)
- [ ] Workbook data connections in database
- [ ] Model versioning
- [ ] Lineage tracking (which cells use which metrics)

### Phase 3 (Advanced)
- [ ] Calculated fields (metric based on other metrics)
- [ ] Joins (combine multiple models)
- [ ] Custom SQL models (not just tables)
- [ ] Metric folders/categories
- [ ] Access control (who can use which metrics)

## 🤝 How This Integrates

```
┌─────────────────┐
│  Spreadsheet    │  User types: =METRIC("new_users")
│  (React UI)     │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Formula        │  Parses formula, gets cell context
│  Evaluator      │  (which column = which time period)
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Semantic       │  ← YOU ARE HERE
│  Layer          │  Gets model + metric, builds SQL
│  (this folder)  │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Snowflake      │  Executes SQL, returns data
│  Client         │
└─────────────────┘
```

## 📝 Adding Your Own Metrics

1. **Identify your data source**: What Snowflake table?
2. **Add a Model** in `registry.ts`:
   - Name it (e.g., "orders")
   - Point to database.schema.table
   - Identify the primary date column

3. **Add Metrics** based on that model:
   - Name them (e.g., "total_orders", "avg_order_value")
   - Specify the measure column and aggregation
   - Add any filters

4. **Use in spreadsheet**: `=METRIC("total_orders")`

That's it! The system handles the rest.

## 🐛 Troubleshooting

**Q: My metric returns 0 even though I have data**
- Check your date column name matches your Snowflake table
- Verify the date range is correct for your column header
- Check if any filters are excluding your data

**Q: I get "Unknown metric" error**
- Make sure the metric name in `=METRIC("name")` matches `registry.ts`
- Check that `org_id` matches (default is 'default')

**Q: How do I debug the SQL being generated?**
- Look at `example-usage.ts` - it shows the actual SQL
- Or add `console.log(query)` in `query-builder.ts`

## 📚 Further Reading

- Type definitions: `/types/index.ts`
- Snowflake client: `/lib/snowflake/client.ts`
- Formula parser: `/lib/formula/parser.ts`

---

**Questions?** This is a living document. Add your questions as comments or create issues!
