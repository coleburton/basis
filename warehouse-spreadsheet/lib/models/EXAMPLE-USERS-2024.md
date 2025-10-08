# Example: Users Metric in Quarterly 2024 Workbook

This document shows **exactly** how your `users` table would work in a quarterly 2024 workbook.

## Your Workbook Setup

```
    A                B           C           D           E           F
1   [empty]          Q1 2024     Q2 2024     Q3 2024     Q4 2024     Total
2   New Users        ???         ???         ???         ???         ???
3   Active Users     ???         ???         ???         ???         ???
```

## Step 1: Define the Users Model

In `lib/models/registry.ts`:

```typescript
users: {
  id: 'model_users',
  org_id: 'your_org_id',
  name: 'users',
  description: 'User accounts from Snowflake',

  // Your Snowflake table
  database: 'ANALYTICS',
  schema: 'PUBLIC',
  table: 'USERS',
  model_type: 'table',

  // IMPORTANT: This tells the system which column to use for time filtering
  primary_date_column: 'created_at',
  date_column_type: 'timestamp',

  created_by: 'system',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}
```

## Step 2: Define Metrics

```typescript
new_users: {
  id: 'metric_new_users',
  org_id: 'your_org_id',
  model_id: 'model_users',

  name: 'new_users',
  display_name: 'New Users',
  description: 'Count of new user registrations',

  measure_column: 'user_id',
  aggregation: 'count_distinct',

  format_type: 'number',

  created_by: 'system',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
},

active_users: {
  id: 'metric_active_users',
  org_id: 'your_org_id',
  model_id: 'model_users',

  name: 'active_users',
  display_name: 'Active Users',
  description: 'Count of active users',

  measure_column: 'user_id',
  aggregation: 'count_distinct',

  // This metric ONLY counts users with status = 'active'
  filters: [
    {
      column: 'status',
      operator: 'eq',
      value: 'active',
    },
  ],

  format_type: 'number',

  created_by: 'system',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}
```

## Step 3: Use in Workbook

### Cell B2: `=METRIC("new_users")`

When you enter this formula in cell B2 (under "Q1 2024" header):

1. **System detects**:
   - Column B = "Q1 2024"
   - Grain = quarterly
   - Date range = Jan 1, 2024 - Mar 31, 2024

2. **Query generated**:
   ```sql
   SELECT COUNT(DISTINCT user_id) as value
   FROM ANALYTICS.PUBLIC.USERS
   WHERE created_at >= '2024-01-01'
     AND created_at < '2024-04-01'
   ```

3. **Result**: `1,250` (example)

### Cell C2: Same formula, different result!

The EXACT SAME formula `=METRIC("new_users")` in column C:

1. **System detects**:
   - Column C = "Q2 2024"
   - Grain = quarterly
   - Date range = Apr 1, 2024 - Jun 30, 2024

2. **Query generated**:
   ```sql
   SELECT COUNT(DISTINCT user_id) as value
   FROM ANALYTICS.PUBLIC.USERS
   WHERE created_at >= '2024-04-01'
     AND created_at < '2024-07-01'
   ```

3. **Result**: `1,380` (example)

### Cell B3: `=METRIC("active_users")`

This metric has a filter for `status = 'active'`:

1. **System detects**:
   - Column B = "Q1 2024"
   - Metric has a filter

2. **Query generated**:
   ```sql
   SELECT COUNT(DISTINCT user_id) as value
   FROM ANALYTICS.PUBLIC.USERS
   WHERE created_at >= '2024-01-01'
     AND created_at < '2024-04-01'
     AND status = 'active'  -- ← Automatically added from metric definition!
   ```

3. **Result**: `980` (example - subset of new_users)

## What Makes This Powerful

### ✅ Write Once, Use Everywhere

Define the metric ONCE in `registry.ts`, then use it in ANY cell:

```
=METRIC("new_users")  // in Q1 2024 column → Jan-Mar 2024 data
=METRIC("new_users")  // in Q2 2024 column → Apr-Jun 2024 data
=METRIC("new_users")  // in "Jan 2024" column → Jan 2024 data
=METRIC("new_users")  // in "2024" column → All 2024 data
```

### ✅ Automatic Date Filtering

You don't specify dates in the formula - they come from the column header!

### ✅ Consistent Business Logic

Filters like `status = 'active'` are defined ONCE on the metric, so everyone gets consistent results.

### ✅ Multi-Tenant Ready

When you have multiple companies using this:

```typescript
// Company A's users model
users: {
  org_id: 'company_a',
  database: 'COMPANY_A_DB',
  // ...
}

// Company B's users model
users: {
  org_id: 'company_b',
  database: 'COMPANY_B_DB',
  // ...
}
```

Same formula, different data sources - automatically isolated by `org_id`.

## Advanced: Adding Global Filters

Let's say you want this workbook to ONLY show users from the "Sales" department:

### Option 1: In the Workbook Data Connection (future feature)

```typescript
// When attaching the users model to this workbook
{
  workbook_id: 'wb_q_2024',
  model_id: 'model_users',
  global_filters: {
    department: 'Sales',  // ← Applied to ALL metrics from users model
  }
}
```

Now EVERY cell using `users` metrics will include `AND department = 'Sales'`.

### Option 2: In the Formula (current capability)

```
=METRIC("new_users", {"department": "Sales"})
```

### Generated SQL with Global Filter:

```sql
SELECT COUNT(DISTINCT user_id) as value
FROM ANALYTICS.PUBLIC.USERS
WHERE created_at >= '2024-01-01'
  AND created_at < '2024-04-01'
  AND status = 'active'      -- From metric definition
  AND department = 'Sales'    -- From global filter
```

## Testing It Out

1. **Update `registry.ts`** with your actual Snowflake table details
2. **Run the example**:
   ```bash
   npx ts-node lib/models/example-usage.ts
   ```
3. **Check the output** - you'll see the exact SQL queries

## Next Steps

1. ✅ Define your `users` model in `registry.ts`
2. ✅ Define metrics like `new_users`, `active_users`
3. ⬜ Integrate with formula evaluator to support `=METRIC()` function
4. ⬜ Add column header parsing to detect time periods
5. ⬜ Connect to Snowflake to actually execute queries
6. ⬜ Cache results for performance

The foundation is ready - now it's about wiring it into your spreadsheet UI!

---

**Questions?**
- See the main [README.md](./README.md) for more details
- Check [example-usage.ts](./example-usage.ts) for runnable code examples
