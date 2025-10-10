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
  filters?: Record<string, string | number | string[]>
} | null {
  // Remove leading = and whitespace
  const normalized = formula.trim().replace(/^=/, '').trim()

  // Check if it starts with METRIC(
  if (!/^METRIC\s*\(/i.test(normalized)) {
    return null
  }

  // Extract content between METRIC( and final )
  const contentMatch = normalized.match(/^METRIC\s*\((.*)\)\s*$/is)
  if (!contentMatch) return null

  const content = contentMatch[1].trim()

  // Find the first quoted string (metric name)
  const metricNameMatch = content.match(/^"([^"]+)"/)
  if (!metricNameMatch) return null

  const metricName = metricNameMatch[1]
  const afterMetricName = content.slice(metricNameMatch[0].length).trim()

  let filters: Record<string, string | number | string[]> = {}

  // Check if there's a comma followed by a JSON object
  if (afterMetricName.startsWith(',')) {
    const jsonString = afterMetricName.slice(1).trim()

    try {
      // Convert single quotes to double quotes for JSON parsing
      const filtersJson = jsonString.replace(/'/g, '"')
      filters = JSON.parse(filtersJson)
    } catch (error) {
      console.error('Failed to parse metric filters:', error, 'JSON:', jsonString)
      return null
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
  filters: Record<string, string | number | string[]>
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
  console.log(`[MetricEvaluator] Evaluating formula at [${row},${col}]:`, formula)

  // Parse the formula
  const parsed = parseMetricFormula(formula)
  if (!parsed) {
    console.error(`[MetricEvaluator] Failed to parse formula:`, formula)
    return {
      value: null,
      loading: false,
      error: 'Invalid METRIC formula syntax',
    }
  }

  const { metricName, filters = {} } = parsed
  console.log(`[MetricEvaluator] Parsed metric:`, { metricName, filters })

  // Find time context for this column
  console.log(`[MetricEvaluator] Looking for time context at col=${col}, row=${row}`)
  console.log(`[MetricEvaluator] Detected ranges:`, detectedRanges.map(r => ({
    rowIndex: r.rowIndex,
    startCol: r.startCol,
    endCol: r.endCol,
    grain: r.context.grain,
    startPeriod: r.context.startPeriod,
    endPeriod: r.context.endPeriod,
  })))

  const timeContext = findTimeContextForColumn(col, row, detectedRanges)
  if (!timeContext) {
    console.error(`[MetricEvaluator] No time context found for column ${col}, row ${row}`)
    return {
      value: null,
      loading: false,
      error: `No time context found (col=${col}, row=${row})`,
    }
  }

  console.log(`[MetricEvaluator] Found time context:`, timeContext)

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
    const requestBody = {
      metricName,
      grain: timeContext.grain,
      startDate: timeContext.startDate,
      endDate: timeContext.endDate,
      filters,
    }
    console.log(`[MetricEvaluator] Making API request to /api/metrics:`, requestBody)

    const response = await fetch('/api/metrics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    console.log(`[MetricEvaluator] API response status:`, response.status, response.statusText)

    if (!response.ok) {
      let errorMessage = 'Failed to fetch metric'
      try {
        const error = await response.json()
        console.error(`[MetricEvaluator] API error response:`, error)
        // Use the details field if available for more specific error info
        errorMessage = error.details || error.error || errorMessage
      } catch {
        // Response wasn't JSON, use the status text
        errorMessage = `${response.status}: ${response.statusText}`
      }
      console.error(`[MetricEvaluator] Returning error:`, errorMessage)
      return {
        value: null,
        loading: false,
        error: errorMessage,
      }
    }

    const data = await response.json()
    console.log(`[MetricEvaluator] API success response:`, data)

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

    console.log(`[MetricEvaluator] Returning result:`, result)
    return result
  } catch (error) {
    console.error('[MetricEvaluator] Caught exception during evaluation:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      value: null,
      loading: false,
      error: errorMessage,
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
