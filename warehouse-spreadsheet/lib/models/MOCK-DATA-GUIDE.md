# 🎭 Mock Data Guide - UI Development

You now have **realistic dummy data** to develop your UI without needing Snowflake!

## 📊 What You Have

### Mock Dataset
- **4,430 users** across 2024
  - Q1: 1,250 users
  - Q2: 1,380 users
  - Q3: 1,520 users
  - Q4: 280 users (partial, through Oct 8)
- **15,521 revenue transactions**
- **Total revenue: $40.5M**

### User Attributes
- `status`: active, inactive, pending
- `department`: Sales, Engineering, Marketing, Support
- `user_type`: free, premium, enterprise
- `country`: US, UK, Germany, France, Canada, Japan, Australia

### Revenue Attributes
- `product`: basic, pro, enterprise
- `region`: US, EU, APAC
- `amount`: $100 - $5,100 per transaction

## 🚀 How to Use in Your UI

### Option 1: API Route (Recommended)

Call the API endpoint from your React components:

```typescript
// In your spreadsheet component
const fetchMetric = async (
  metricName: string,
  startDate: string,
  endDate: string
) => {
  const response = await fetch('/api/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      metricName,
      grain: 'quarter',
      startDate,
      endDate,
    }),
  });

  const data = await response.json();
  return data.value; // The metric value
};

// Example: Get Q1 2024 new users
const q1Users = await fetchMetric('new_users', '2024-01-01', '2024-04-01');
// Returns: 1250
```

### Option 2: Direct Import (for testing)

```typescript
import { getMockExecutor } from '@/lib/models/mock-executor';
import { getModel, getMetric } from '@/lib/models/registry';

const model = getModel('users');
const metric = getMetric('new_users');
const executor = getMockExecutor();

const value = await executor.executeMetricQuery(model!, metric!, {
  grain: 'quarter',
  startDate: '2024-01-01',
  endDate: '2024-04-01',
});

console.log(value); // 1250
```

## 📝 Example: Quarterly Workbook

### Your Spreadsheet Grid

```
    A                B           C           D           E
1   [empty]          Q1 2024     Q2 2024     Q3 2024     Q4 2024
2   New Users        ???         ???         ???         ???
3   Active Users     ???         ???         ???         ???
4   Total Revenue    ???         ???         ???         ???
```

### Code to Populate It

```typescript
// Define your column headers with their date ranges
const columns = [
  { label: 'Q1 2024', start: '2024-01-01', end: '2024-04-01' },
  { label: 'Q2 2024', start: '2024-04-01', end: '2024-07-01' },
  { label: 'Q3 2024', start: '2024-07-01', end: '2024-10-01' },
  { label: 'Q4 2024', start: '2024-10-01', end: '2025-01-01' },
];

// Define your metrics (rows)
const metrics = ['new_users', 'active_users', 'total_revenue'];

// Fetch all cell values
for (const metric of metrics) {
  for (const col of columns) {
    const value = await fetch('/api/metrics', {
      method: 'POST',
      body: JSON.stringify({
        metricName: metric,
        grain: 'quarter',
        startDate: col.start,
        endDate: col.end,
      }),
    }).then(r => r.json());

    // Set cell value in your grid
    // cell[metric][col.label] = value.value
  }
}
```

### Expected Results

| Metric | Q1 2024 | Q2 2024 | Q3 2024 | Q4 2024 |
|--------|---------|---------|---------|---------|
| New Users | 1,250 | 1,380 | 1,520 | 280 |
| Active Users | 395 | 451 | 501 | 132 |
| Total Revenue | $1,659,002 | $4,227,710 | $4,886,448 | $766,740 |

(Exact numbers may vary slightly due to random distribution)

## 🧪 Testing

### Run Tests
```bash
npx tsx lib/models/test-mock-data.ts
```

Output shows:
- ✅ All quarterly totals match
- ✅ Filters work (active_users < new_users)
- ✅ Aggregations work (SUM, COUNT, etc.)
- ✅ Monthly granularity works

### List Available Metrics

```bash
curl http://localhost:3001/api/metrics
```

Returns:
```json
{
  "metrics": [
    {
      "name": "new_users",
      "display_name": "New Users",
      "format_type": "number",
      "aggregation": "count_distinct"
    },
    {
      "name": "active_users",
      "display_name": "Active Users",
      "format_type": "number",
      "aggregation": "count_distinct"
    },
    {
      "name": "total_revenue",
      "display_name": "Total Revenue",
      "format_type": "currency",
      "aggregation": "sum"
    }
  ]
}
```

### Fetch a Specific Metric

```bash
curl -X POST http://localhost:3001/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "metricName": "new_users",
    "grain": "quarter",
    "startDate": "2024-01-01",
    "endDate": "2024-04-01"
  }'
```

Returns:
```json
{
  "metric": "new_users",
  "display_name": "New Users",
  "value": 1250,
  "grain": "quarter",
  "period": {
    "start": "2024-01-01",
    "end": "2024-04-01"
  },
  "format": {
    "type": "number"
  },
  "cached": false,
  "source": "mock_data"
}
```

## 🎨 UI Integration Examples

### React Hook for Metrics

```typescript
// hooks/useMetric.ts
import { useState, useEffect } from 'react';

export function useMetric(
  metricName: string,
  startDate: string,
  endDate: string
) {
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchMetric = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metricName,
            grain: 'quarter',
            startDate,
            endDate,
          }),
        });

        if (!cancelled) {
          const data = await response.json();
          setValue(data.value);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchMetric();

    return () => {
      cancelled = true;
    };
  }, [metricName, startDate, endDate]);

  return { value, loading, error };
}
```

### Use in Component

```typescript
// components/MetricCell.tsx
function MetricCell({
  metricName,
  startDate,
  endDate,
}: {
  metricName: string;
  startDate: string;
  endDate: string;
}) {
  const { value, loading } = useMetric(metricName, startDate, endDate);

  if (loading) return <div>Loading...</div>;

  return <div>{value?.toLocaleString()}</div>;
}

// Usage
<MetricCell
  metricName="new_users"
  startDate="2024-01-01"
  endDate="2024-04-01"
/>
// Renders: 1,250
```

## 🔄 Switching to Real Data

When you're ready to use real Snowflake data:

1. Set environment variables for Snowflake
2. In `app/api/metrics/route.ts`, change:
   ```typescript
   // From:
   const executor = getMockExecutor();

   // To:
   import { getSnowflakeClient } from '@/lib/snowflake/client';
   import { getQueryBuilder } from '@/lib/models/query-builder';

   const queryBuilder = getQueryBuilder();
   const sql = queryBuilder.buildMetricQuery(model, metric, context);
   const snowflake = getSnowflakeClient();
   const result = await snowflake.execute(sql);
   const value = result.rows[0]?.value || 0;
   ```

That's it! Your UI code doesn't need to change - just the data source.

## 📚 Files Reference

- `lib/models/mock-data.ts` - The generated dataset
- `lib/models/mock-executor.ts` - Query execution against mock data
- `lib/models/test-mock-data.ts` - Test suite
- `app/api/metrics/route.ts` - API endpoint for UI
- `lib/models/registry.ts` - Metric definitions

---

**You're all set to build your UI!** 🎉

The mock data is realistic, the API works, and you can switch to real Snowflake later without changing your UI code.
