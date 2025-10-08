# Warehouse-Native Spreadsheet App

A browser-based spreadsheet application that connects directly to Snowflake, enabling finance teams to build dynamic models with warehouse-backed metrics.

## Features (v1)

- **Spreadsheet UX**: Excel-like grid with formulas, copy/paste, undo/redo
- **Warehouse Integration**: Direct Snowflake connectivity for governed data access
- **Metric Functions**: Custom `METRIC()` and `METRICRANGE()` formulas that pull data by period grain
- **SQL Console**: Safe SQL editor for creating and managing models
- **Model Catalog**: Browse available tables and views from Snowflake
- **Scenarios**: Create multiple scenarios with cell-level overrides
- **Caching**: Redis-backed metric caching for performance

## Project Status

**Current Progress**: Infrastructure scaffold complete ✅

### Completed
- ✅ Next.js project setup with TypeScript, Tailwind, shadcn/ui
- ✅ Snowflake client wrapper with SQL validation
- ✅ Supabase schema and migrations
- ✅ Redis caching layer (with in-memory fallback)
- ✅ Grain inference logic (day/month/quarter/year)
- ✅ Metrics registry and resolver
- ✅ API routes: `/api/metrics/[name]`, `/api/sql/preview`, `/api/sql/run`, `/api/catalog`
- ✅ Type definitions for all core entities

### In Progress / Next Steps
- ⏳ Grid component with Glide Data Grid
- ⏳ HyperFormula integration with custom functions
- ⏳ SQL console UI (Monaco editor)
- ⏳ Model catalog panel
- ⏳ Top toolbar (scenario selector, refresh)
- ⏳ Scenario management and cell overrides

## Architecture

```
┌─────────────────┐
│   Next.js App   │
│   (Frontend)    │
└────────┬────────┘
         │
    ┌────┴─────┐
    │   API    │
    │  Routes  │
    └─┬───┬───┬┘
      │   │   │
      v   v   v
┌─────┴───┴───┴────┐
│  Snowflake SDK    │  ← Metrics, SQL execution
├───────────────────┤
│  Supabase Client  │  ← App DB, Auth
├───────────────────┤
│  Upstash Redis    │  ← Caching
└───────────────────┘
```

## Setup Instructions

### 1. Prerequisites

- Node.js 18+
- Snowflake account with appropriate schemas and roles
- Supabase project
- (Optional) Upstash Redis account

### 2. Clone & Install

```bash
cd /Users/coleburton/Dropbox/basis
npm install
```

### 3. Environment Configuration

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Required variables:

```env
# Snowflake
SNOWFLAKE_ACCOUNT=your_account.region
SNOWFLAKE_USER=your_username
SNOWFLAKE_PASSWORD=your_password
SNOWFLAKE_DATABASE=your_database
SNOWFLAKE_WAREHOUSE=your_warehouse
SNOWFLAKE_ROLE=your_role

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Upstash Redis (optional - will use in-memory cache if not set)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token
```

### 4. Snowflake Setup

Run the following in Snowflake to set up the required schemas and roles:

```sql
-- Create analytics schema (read-only dbt models)
CREATE SCHEMA IF NOT EXISTS ANALYTICS;

-- Create workspace schema for user-created models
CREATE SCHEMA IF NOT EXISTS APP_WORKSPACE_DEFAULT;

-- Create roles (adjust permissions as needed)
CREATE ROLE IF NOT EXISTS APP_READONLY_ROLE;
CREATE ROLE IF NOT EXISTS APP_WORKSPACE_ROLE_DEFAULT;

-- Grant permissions
GRANT USAGE ON SCHEMA ANALYTICS TO ROLE APP_READONLY_ROLE;
GRANT SELECT ON ALL TABLES IN SCHEMA ANALYTICS TO ROLE APP_READONLY_ROLE;

GRANT USAGE ON SCHEMA APP_WORKSPACE_DEFAULT TO ROLE APP_WORKSPACE_ROLE_DEFAULT;
GRANT CREATE TABLE ON SCHEMA APP_WORKSPACE_DEFAULT TO ROLE APP_WORKSPACE_ROLE_DEFAULT;
GRANT CREATE VIEW ON SCHEMA APP_WORKSPACE_DEFAULT TO ROLE APP_WORKSPACE_ROLE_DEFAULT;
```

### 5. Supabase Setup

1. Create a new Supabase project
2. Run the migration:
   ```bash
   # Copy the SQL from supabase/migrations/001_initial_schema.sql
   # Paste and run in Supabase SQL Editor
   ```
3. Update your `.env.local` with Supabase credentials

### 6. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## API Reference

### Metrics API

```
GET /api/metrics/{name}?start={date}&end={date}&grain={grain}&dims={json}
```

**Example:**
```bash
curl "http://localhost:3000/api/metrics/families_acquired?start=2024-01-01&end=2024-02-01&grain=month"
```

**Response:**
```json
{
  "metric": "families_acquired",
  "grain": "month",
  "data": [
    {
      "period": "2024-01",
      "value": 1250,
      "dimensions": {}
    }
  ],
  "cached": false,
  "query_time_ms": 423
}
```

### SQL API

#### Preview SQL
```
POST /api/sql/preview
Content-Type: application/json

{
  "sql": "SELECT * FROM ANALYTICS.FAMILIES_ACQUIRED_MONTHLY LIMIT 10"
}
```

#### Run SQL
```
POST /api/sql/run
Content-Type: application/json

{
  "sql": "CREATE TABLE APP_WORKSPACE_DEFAULT.MY_MODEL AS SELECT ...",
  "model_name": "my_model"
}
```

### Catalog API

```
GET /api/catalog
```

Returns list of available tables and views from both Analytics schema and user workspace.

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── metrics/[name]/route.ts    # Metrics endpoint
│   │   ├── sql/
│   │   │   ├── preview/route.ts       # SQL preview
│   │   │   └── run/route.ts           # SQL execution
│   │   └── catalog/route.ts           # Model catalog
│   ├── page.tsx                       # Main spreadsheet page
│   └── globals.css                    # Global styles
├── components/
│   ├── grid/                          # Spreadsheet grid components
│   ├── catalog/                       # Model catalog panel
│   ├── sql-console/                   # SQL editor
│   └── ui/                            # shadcn/ui components
├── lib/
│   ├── snowflake/
│   │   └── client.ts                  # Snowflake SDK wrapper
│   ├── supabase/
│   │   └── client.ts                  # Supabase client
│   ├── cache/
│   │   └── redis.ts                   # Redis caching layer
│   ├── formula/
│   │   └── grain-inference.ts         # Date grain detection
│   └── metrics/
│       ├── registry.ts                # Metric definitions
│       └── resolver.ts                # Metric query engine
├── types/
│   └── index.ts                       # TypeScript types
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     # Database schema
└── .env.local                         # Environment variables
```

## Metrics Registry

Edit `lib/metrics/registry.ts` to add new metrics:

```typescript
export const METRICS_REGISTRY: Record<string, MetricDefinition> = {
  your_metric: {
    name: 'your_metric',
    description: 'Description here',
    source_table: 'ANALYTICS.YOUR_TABLE',
    date_column: 'period_month',
    value_column: 'value',
    dimension_columns: ['channel', 'region'],
    aggregation: 'sum',
  },
};
```

## Security Features

- **SQL Validation**: Allowlist-based SQL validation prevents dangerous operations
- **Sandboxed Execution**: User SQL runs in org-specific workspace schemas
- **Timeouts**: 60-second timeout on all Snowflake queries
- **Row Limits**: Preview mode limited to 200 rows

### Allowed SQL Statements
- `SELECT`
- `CREATE TABLE ... AS SELECT`
- `CREATE OR REPLACE VIEW`
- `INSERT INTO ... SELECT`
- `TRUNCATE TABLE`

### Denied SQL Patterns
- `DROP DATABASE/SCHEMA/TABLE`
- `ALTER ACCOUNT/USER`
- `GRANT/REVOKE`
- `MERGE`
- `DELETE/UPDATE` (for v1)

## Troubleshooting

### Snowflake Connection Issues
- Verify your account identifier format: `account.region.cloud`
- Ensure role has appropriate warehouse usage
- Check firewall/network settings

### Supabase Connection Issues
- Verify project URL and anon key
- Check RLS policies if queries fail
- Ensure migrations have been run

### Cache Not Working
- Redis is optional - app will use in-memory cache if Redis isn't configured
- Check Upstash credentials if using Redis
- Cache TTL is 15 minutes by default (configurable via `METRIC_CACHE_TTL_SECONDS`)

## Next Development Steps

1. **Grid Component**: Implement spreadsheet grid with Glide Data Grid
2. **Formula Engine**: Integrate HyperFormula with custom `METRIC()` / `METRICRANGE()` functions
3. **SQL Console**: Build Monaco editor UI with syntax highlighting
4. **Model Catalog**: Create browsable catalog panel
5. **Scenarios**: Implement scenario switching and cell overrides
6. **Example Data**: Create sample workbook with demo metrics

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **Spreadsheet**: Glide Data Grid
- **Formula Engine**: HyperFormula
- **Code Editor**: Monaco Editor
- **Data Warehouse**: Snowflake
- **Database**: Supabase (PostgreSQL)
- **Cache**: Upstash Redis
- **State**: Zustand
- **Data Fetching**: TanStack Query

## License

MIT
