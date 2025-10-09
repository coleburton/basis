/**
 * Async Metric Evaluator
 * Handles METRIC() and METRICRANGE() formulas that fetch data from the warehouse API
 */

import type { DetectedDateRange } from '@/lib/date-detection'

export interface MetricEvaluationResult {
  value: number | string | null
  loading: boolean
  error: string | null
  cachedAt?: number
}

interface MetricCache {
  [key: string]: {
    result: MetricEvaluationResult
    timestamp: number
  }
}

// Cache metric results for 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000
const cache: MetricCache = {}

/**
 * Parse a METRIC() formula to extract the metric name and optional filters
 * Examples:
 *   =METRIC("new_users") → { metricName: "new_users", filters: {} }
 *   =METRIC("revenue", {"region": "US"}) → { metricName: "revenue", filters: { region: "US" } }
 */
export function parseMetricFormula(formula: string): {
  metricName: string
  filters?: Record<string, string | number>
} | null {
  // Remove leading = and whitespace
  const normalized = formula.trim().replace(/^=/, '').trim()

  // Match METRIC("name") or METRIC("name", {...})
  const match = normalized.match(/^METRIC\s*\(\s*"([^"]+)"(?:\s*,\s*(\{[^}]+\}))?\s*\)$/i)

  if (!match) return null

  const metricName = match[1]
  let filters: Record<string, string | number> = {}

  // Parse filters if present
  if (match[2]) {
    try {
      // Convert single quotes to double quotes for JSON parsing
      const filtersJson = match[2].replace(/'/g, '"')
      filters = JSON.parse(filtersJson)
    } catch (error) {
      console.error('Failed to parse metric filters:', error)
    }
  }

  return { metricName, filters }
}

/**
 * Find the time context for a specific column based on detected date ranges
 */
export function findTimeContextForColumn(
  col: number,
  row: number,
  detectedRanges: DetectedDateRange[]
): {
  startDate: string
  endDate: string
  grain: string
} | null {
  // Find the date range that applies to this cell
  // Look for ranges in rows above the current row
  let relevantRange: DetectedDateRange | null = null
  for (const range of detectedRanges) {
    if (range.rowIndex < row && col >= range.startCol && col <= range.endCol) {
      if (!relevantRange || range.rowIndex > relevantRange.rowIndex) {
        relevantRange = range
      }
    }
  }

  if (!relevantRange) {
    return null
  }

  // Calculate which period this column represents
  const periodIndex = col - relevantRange.startCol
  const period = relevantRange.context.periods[periodIndex]

  if (!period) {
    return null
  }

  // Calculate start and end dates based on grain and period
  const { grain, year, period: periodNumber } = period

  let startDate: Date
  let endDate: Date

  switch (grain) {
    case 'quarter':
      if (periodNumber) {
        const startMonth = (periodNumber - 1) * 3
        startDate = new Date(year, startMonth, 1)
        endDate = new Date(year, startMonth + 3, 1)
      } else {
        return null
      }
      break

    case 'month':
      if (periodNumber) {
        startDate = new Date(year, periodNumber - 1, 1)
        endDate = new Date(year, periodNumber, 1)
      } else {
        return null
      }
      break

    case 'year':
      startDate = new Date(year, 0, 1)
      endDate = new Date(year + 1, 0, 1)
      break

    case 'day':
      if (period.startDate && period.endDate) {
        startDate = period.startDate
        endDate = new Date(period.endDate)
        endDate.setDate(endDate.getDate() + 1) // End date is exclusive
      } else {
        return null
      }
      break

    default:
      return null
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    grain,
  }
}

/**
 * Generate a cache key for a metric evaluation
 */
function getCacheKey(
  metricName: string,
  startDate: string,
  endDate: string,
  filters: Record<string, string | number>
): string {
  const filtersStr = JSON.stringify(filters)
  return `${metricName}:${startDate}:${endDate}:${filtersStr}`
}

/**
 * Evaluate a METRIC() formula asynchronously
 */
export async function evaluateMetricFormula(
  formula: string,
  row: number,
  col: number,
  detectedRanges: DetectedDateRange[]
): Promise<MetricEvaluationResult> {
  // Parse the formula
  const parsed = parseMetricFormula(formula)
  if (!parsed) {
    return {
      value: null,
      loading: false,
      error: 'Invalid METRIC formula syntax',
    }
  }

  const { metricName, filters = {} } = parsed

  // Find time context for this column
  const timeContext = findTimeContextForColumn(col, row, detectedRanges)
  if (!timeContext) {
    return {
      value: null,
      loading: false,
      error: 'No time context found for this column',
    }
  }

  // Check cache
  const cacheKey = getCacheKey(metricName, timeContext.startDate, timeContext.endDate, filters)
  const cached = cache[cacheKey]
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return {
      ...cached.result,
      cachedAt: cached.timestamp,
    }
  }

  // Make API call
  try {
    const response = await fetch('/api/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metricName,
        grain: timeContext.grain,
        startDate: timeContext.startDate,
        endDate: timeContext.endDate,
        filters,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        value: null,
        loading: false,
        error: error.error || 'Failed to fetch metric',
      }
    }

    const data = await response.json()
    const result: MetricEvaluationResult = {
      value: data.value,
      loading: false,
      error: null,
    }

    // Cache the result
    cache[cacheKey] = {
      result,
      timestamp: Date.now(),
    }

    return result
  } catch (error) {
    console.error('Metric evaluation error:', error)
    return {
      value: null,
      loading: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check if a formula is a METRIC formula
 */
export function isMetricFormula(formula: string): boolean {
  if (!formula || !formula.trim().startsWith('=')) {
    return false
  }
  const normalized = formula.trim().replace(/^=/, '').trim()
  return /^METRIC\s*\(/i.test(normalized)
}

/**
 * Clear the metric cache (useful for refresh)
 */
export function clearMetricCache(): void {
  Object.keys(cache).forEach(key => delete cache[key])
}
