# 🚀 Quick Start: Semantic Layer for Your Users Metric

## What You Now Have

A **semantic layer** that works like Excel's Power Query or Power BI's data model:

1. **Models** = Your Snowflake tables (defined once, reused everywhere)
2. **Metrics** = Calculated measures (COUNT, SUM, etc.)
3. **Context-aware** = Same formula, different results based on column headers

## 📝 Your Example: Users Table in 2024 Quarterly Workbook

### What You Want

```
Workbook with columns: Q1 2024 | Q2 2024 | Q3 2024 | Q4 2024
Formula: =METRIC("new_users")

Expected behavior:
- Q1 2024 column → COUNT users WHERE created_at between Jan-Mar 2024
- Q2 2024 column → COUNT users WHERE created_at between Apr-Jun 2024
- etc.
```

### What You Got

✅ **Type definitions** (`/types/index.ts`)
- `Model` - represents your Snowflake table
- `MetricDefinition` - represents a calculated measure
- `WorkbookDataConnection` - connects models to workbooks
- `QueryContext` - the cell's environment (time period, filters)

✅ **Model & Metric Registry** (`lib/models/registry.ts`)
- Define your `users` table as a Model
- Define metrics like `new_users`, `active_users`
- Helper functions to look them up

✅ **Query Builder** (`lib/models/query-builder.ts`)
- Takes: Model + Metric + Context (Q1 2024)
- Returns: Proper SQL query for Snowflake
- Handles: Time filtering, aggregations, filters

✅ **Examples** (`lib/models/example-usage.ts`)
- Runnable examples showing the SQL generated
- Test different scenarios (quarterly, monthly, etc.)

✅ **Documentation**
- `README.md` - Full documentation
- `EXAMPLE-USERS-2024.md` - Your specific use case
- `QUICKSTART.md` - You are here!

## 🎯 How to Use (3 Steps)

### Step 1: Configure Your Model

Edit `lib/models/registry.ts`:

```typescript
export const MODELS_REGISTRY = {
  users: {
    // ... update with YOUR Snowflake details
    database: 'YOUR_DATABASE',
    schema: 'YOUR_SCHEMA',
    table: 'USERS',
    primary_date_column: 'created_at', // or signup_date, etc.
  }
};
```

### Step 2: Define Your Metrics

Still in `registry.ts`:

```typescript
export const METRICS_REGISTRY = {
  new_users: {
    model_id: 'model_users',
    measure_column: 'user_id',
    aggregation: 'count_distinct',
    // ... done!
  }
};
```

### Step 3: Test It

```bash
npx ts-node lib/models/example-usage.ts
```

You'll see the exact SQL that would be generated for Q1 2024, Q2 2024, etc.

## 🔌 Next: Integration with Spreadsheet

The semantic layer is **ready to use**. Now you need to:

1. **Parse column headers** to detect time periods
   - "Q1 2024" → `{ grain: 'quarter', startDate: '2024-01-01', endDate: '2024-04-01' }`
   - Located in: `lib/formula/grain-inference.ts` (already exists!)

2. **Add METRIC() function** to formula evaluator
   - When user types `=METRIC("new_users")`
   - Call: `queryBuilder.buildMetricQuery(model, metric, context)`
   - Execute SQL via Snowflake client
   - Return result

3. **Cache results** for performance
   - Located in: `lib/cache/redis.ts` (already exists!)

4. **Attach models to workbooks**
   - Store in database: `workbook_data_connections` table
   - Allows global filters per workbook

## 📊 Architecture Flow

```
User types formula → Formula Parser → Semantic Layer → Snowflake → Result
                                           ↓
                                    [Model Registry]
                                    [Metric Registry]
                                    [Query Builder]
```

## 🌟 Key Benefits

1. **Write Once, Use Everywhere**
   - Define `users` model once
   - Use in any workbook, any cell, any time period

2. **Automatic Context Awareness**
   - Same formula in different columns = different date ranges
   - No manual date parameters needed

3. **Consistent Business Logic**
   - Filters defined on metrics apply everywhere
   - `active_users` always means `status = 'active'`

4. **Multi-Tenant Ready**
   - Each org defines their own models
   - Data automatically isolated by `org_id`

5. **Type-Safe**
   - Full TypeScript support
   - Catches errors at compile time

## 🐛 Testing Your Setup

1. **Check model definition**:
   ```typescript
   import { getModel } from './lib/models/registry';
   const model = getModel('users');
   console.log(model); // Should show your Snowflake table config
   ```

2. **Check metric definition**:
   ```typescript
   import { getMetric } from './lib/models/registry';
   const metric = getMetric('new_users');
   console.log(metric); // Should show your aggregation config
   ```

3. **Generate SQL**:
   ```typescript
   import { getQueryBuilder } from './lib/models/query-builder';

   const query = queryBuilder.buildMetricQuery(model, metric, {
     grain: 'quarter',
     startDate: '2024-01-01',
     endDate: '2024-04-01',
   });

   console.log(query); // See the actual SQL!
   ```

## 📚 Learn More

- **Full Documentation**: [README.md](./README.md)
- **Your Use Case**: [EXAMPLE-USERS-2024.md](./EXAMPLE-USERS-2024.md)
- **Runnable Examples**: [example-usage.ts](./example-usage.ts)
- **Type Definitions**: [/types/index.ts](/types/index.ts)

## 🤝 Phase 2: Multi-Tenant (Future)

Currently, models are defined in code. In Phase 2:

- ✅ Models stored in database per-org
- ✅ UI for defining models (no code!)
- ✅ Workbook connections in database
- ✅ User permissions on models/metrics

But the **core architecture is ready** for this!

---

**You're all set!** The semantic layer is built and ready to power your spreadsheet formulas. 🎉
