# Warehouse-Native Spreadsheet App — v1 Build Spec

This doc is a **handoff for an LLM/engineer** to implement a lightweight, browser-based spreadsheet that:
1. feels like Google Sheets/Excel,  
2. reads/writes **models in Snowflake** (safe, governed), and  
3. lets Finance compose spreadsheets that **pull metrics by period (month/quarter/year)** and combine them with user-entered assumptions.

---

## 0. Guiding Principles
- **Warehouse-first**: Truth lives in Snowflake. The app can **execute SQL** to create governed models/tables that other sheets reference.
- **Spreadsheet UX**: Fast grid, Excel-style formulas, copy/paste, undo/redo.  
- **Metrics as APIs**: Sheet formulas call **grain-aware** endpoints (month|quarter|year); headers drive grain.  
- **Safety by design**: SQL runs with a **restricted role** into **per-org sandbox schemas** with allowlisted statements and timeouts.  
- **MVP over features**: Core editing + metric fetch + SQL console + scenarios + caching. Everything else is vNext.

---

## 1. User Roles / Personas
- **Data person (Creator)**: writes SQL models; publishes/updates datasets; sets refresh and access.  
- **Finance user (Composer)**: builds spreadsheets using models + assumptions; changes period view (M/Q/Y), scenarios, exports.

---

## 2. High-Level Architecture

**Frontend**
- Next.js (App Router), React, Tailwind, shadcn/ui, Zustand, React Query, Framer Motion.
- Grid: **Glide Data Grid** (fast, OSS).
- Formula engine: **HyperFormula** with **custom functions** (`METRIC`, `METRICRANGE`).
- Web Worker for HyperFormula.

**Backend**
- Next.js API routes (serverless on Vercel).  
- **Snowflake** via Node SDK (read + restricted write).  
- **Supabase** for Auth (email/GitHub/Google), Postgres (app DB), RLS, and cron jobs.  
- **Redis/Upstash** for caching metric responses.  

---

## 3. Data Model (Postgres)

- `orgs`, `users` (with roles).  
- `workbooks`, `sheets`, `scenarios`.  
- `cell_overrides` (stores scenario-specific overrides).  
- `metric_cache` (cached Snowflake metric results).  
- `refresh_schedules` (cron config).  
- `sql_jobs` (track model creation/update runs).  
- `models_catalog` (list of Snowflake models available).  
- `audit_log`.

---

## 4. Snowflake Layout & Security

- **Schemas**:  
  - `ANALYTICS` (dbt models, read-only).  
  - `APP_WORKSPACE_<org>` (safe, org-specific sandbox).  

- **Roles**:  
  - `APP_READONLY_ROLE` (dbt models).  
  - `APP_WORKSPACE_ROLE_<org>` (restricted DDL/DML in sandbox).  

- **Allowlisted SQL**:  
  - `SELECT`, `CREATE TABLE ... AS SELECT`, `CREATE OR REPLACE VIEW ...`, `INSERT INTO ... SELECT`, `TRUNCATE TABLE`.  
- **Denylisted SQL**:  
  - `DROP DATABASE/SCHEMA/TABLE`, `ALTER ACCOUNT/USER`, `MERGE`, `GRANT`, `CALL`, etc.  
- **Timeouts**: 60s max, preview mode with row limit.

---

## 5. Core Features (v1)

### 5.1 Spreadsheet UX
- Monthly/Quarterly/Yearly headers.  
- Excel-style formulas.  
- Copy/paste, undo/redo.  
- Cell formats (number, text, currency, percent).

### 5.2 Metric Functions
- `METRIC(name, start_date, end_date, [grain], [dims_json]) → number`  
- `METRICRANGE(name, header_range, [dims_json]) → array`  
- Grain inferred from header cells.  
- JSON dimensions (`{"channel":"Organic"}`).

### 5.3 SQL Console (for Creators)
- Monaco editor.  
- Dry run (preview 200 rows).  
- Run (executes in sandbox schema).  
- On success → register model in catalog.

### 5.4 Model Catalog
- Lists available dbt + sandbox models.  
- Inspect schema, preview rows.  
- Copy usage snippets (example formulas).

### 5.5 Metric Endpoints
- REST API for each metric:  
  `/api/metrics/{name}?start=...&end=...&grain=month|quarter|year&dims=...`  
- Aggregates from dbt tables or queries.  
- Cache responses.

### 5.6 Scenarios & Overrides
- Scenario dropdown.  
- Overrides stored per scenario.  
- Recalc merges overrides with metric values.

### 5.7 Scheduling / Refresh
- Supabase cron precomputes recent metrics.  
- Cache warm-ups for last 36 months.  
- Manual refresh button.

### 5.8 Auth & RBAC
- Supabase Auth.  
- Creators: SQL + publish.  
- Composers: sheet usage only.  
- Viewers: read-only (optional v1).

### 5.9 Audit / Observability
- Logs for SQL jobs, metric hits, sheet changes.  
- Track cache hit/miss, Snowflake query times.

---

## 6. Out of Scope (v1)
- Real-time multi-user co-editing.  
- Pivot tables, charts, conditional formatting.  
- Free-form Snowflake access.  
- dbt orchestration (read-only only).  
- Fine-grained column-level permissions.  
- File imports beyond CSV.  

---

## 7. API Surface (v1)

### Metrics
```
GET /api/metrics/{name}?start&end&grain&dims&fill&fiscal
```

### SQL Jobs
```
POST /api/sql/preview
POST /api/sql/run
GET  /api/sql/jobs/{job_id}
```

### Catalog
```
GET /api/catalog
GET /api/catalog/{db}/{schema}/{identifier}/sample
```

### Sheets
```
GET  /api/workbooks/:id/sheets
POST /api/workbooks/:id/sheets
PATCH /api/sheets/:id
POST /api/sheets/:id/overrides
POST /api/workbooks/:id/scenarios
```

---

## 8. Frontend Details

### Grid + Formula Engine
- HyperFormula plugins for `METRIC` and `METRICRANGE`.  
- Grain inferred from header deltas.  

### UI Panels
- Left: Catalog (search, copy snippets).  
- Bottom: SQL console (Creators only).  
- Top bar: Scenario, Time context, Refresh.

### User Flow
- Creator writes SQL → model created in Snowflake → appears in Catalog → finance composes sheet with `METRICRANGE`.

---

## 9. Example Queries

### Safe Model Creation
```sql
CREATE TABLE APP_WORKSPACE_ORG.FAMILIES_ACQUIRED_MONTHLY AS
SELECT DATE_TRUNC('month', month) as period_month,
       channel,
       SUM(families) as families
FROM ANALYTICS.RAW_FAMILY_ACQ
GROUP BY 1,2;
```

### Metric Resolver
```sql
SELECT DATE_TRUNC(:grain, period_month) as period,
       channel,
       SUM(families) as value
FROM APP_WORKSPACE_ORG.FAMILIES_ACQUIRED_MONTHLY
WHERE period_month >= :start
  AND period_month < :end
GROUP BY 1,2;
```

---

## 10. Caching & Refresh
- Redis/Supabase cache (15 min TTL).  
- Cron precomputes common windows.  
- Cache key: `org|metric|grain|start|end|dimsHash`.

---

## 11. Deliverables
- Next.js repo with grid, HyperFormula, metric plugins, catalog, SQL console.  
- Supabase migrations for app DB.  
- Metric mock + Snowflake integration.  
- Example workbook showing `families_acquired`.  
- README with `.env` + Snowflake setup.

---

## 12. Acceptance Tests
- Create model → appears in catalog.  
- Monthly headers → monthly values.  
- Switch to quarterly headers → aggregated values.  
- Scenario override only affects selected scenario.  
- Cache prevents duplicate Snowflake hits.  
- Denylisted SQL blocked.

---

## 13. Roadmap (Post-v1)
- Realtime collaboration.  
- Charts and pivots.  
- dbt metadata ingestion.  
- Parameterized models.  
- Writeback from sheets.  
- SSO and SCIM.

---
