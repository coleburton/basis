/**
 * Utility functions for detecting date ranges and patterns from spreadsheet headers
 */

export type DateGrain = 'day' | 'week' | 'month' | 'quarter' | 'year'

export interface DatePeriod {
  label: string
  grain: DateGrain
  year: number
  period?: number // Q1 = 1, Q2 = 2, etc. or month number, etc.
  startDate?: Date
  endDate?: Date
}

export interface DetectedTimeContext {
  grain: DateGrain
  periods: DatePeriod[]
  startPeriod: string // e.g., "2024-Q1"
  endPeriod: string // e.g., "2024-Q4"
  confidence: 'high' | 'medium' | 'low'
}

export interface DetectedDateRange {
  rowIndex: number
  startCol: number // First column of the date range
  endCol: number   // Last column of the date range
  context: DetectedTimeContext
  isNew: boolean
  detectedAt: number
}

/**
 * Parse a quarter label like "Q1 2024" or "2024-Q1"
 */
function parseQuarterLabel(label: string): DatePeriod | null {
  // Match patterns like "Q1 2024", "2024-Q1", "Q1 '24", "2024 Q1", etc.
  const patterns = [
    /Q(\d)\s+(\d{4})/i,           // Q1 2024
    /(\d{4})\s*[-\s]*Q(\d)/i,     // 2024-Q1 or 2024 Q1
    /Q(\d)\s+'(\d{2})/i,          // Q1 '24
    /(\d{4})\s*Q(\d)/i,           // 2024Q1
  ]

  for (const pattern of patterns) {
    const match = label.match(pattern)
    if (match) {
      let quarter: number
      let year: number

      if (pattern.source.startsWith('Q')) {
        // Pattern starts with Q
        quarter = parseInt(match[1], 10)
        year = match[2].length === 2 ? 2000 + parseInt(match[2], 10) : parseInt(match[2], 10)
      } else {
        // Pattern starts with year
        year = match[1].length === 2 ? 2000 + parseInt(match[1], 10) : parseInt(match[1], 10)
        quarter = parseInt(match[2], 10)
      }

      if (quarter >= 1 && quarter <= 4) {
        return {
          label,
          grain: 'quarter',
          year,
          period: quarter,
        }
      }
    }
  }

  return null
}

/**
 * Parse a month label like "Jan 2024", "2024-01", "January 2024"
 */
function parseMonthLabel(label: string): DatePeriod | null {
  const monthNames = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ]
  const monthAbbr = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

  // Match patterns like "Jan 2024", "2024-01", "January 2024"
  const patterns = [
    /(\w+)\s+(\d{4})/i,           // Jan 2024, January 2024
    /(\d{4})\s*[-\/]\s*(\d{1,2})/,  // 2024-01, 2024/1
    /(\w+)\s+'(\d{2})/i,          // Jan '24
  ]

  for (const pattern of patterns) {
    const match = label.match(pattern)
    if (match) {
      let month: number | null = null
      let year: number

      if (pattern.source.startsWith('(\\w+)')) {
        // Month name comes first
        const monthStr = match[1].toLowerCase()
        const monthIndex = monthNames.findIndex(m => m.startsWith(monthStr)) ||
                          monthAbbr.findIndex(m => m === monthStr)

        if (monthIndex >= 0) {
          month = monthIndex + 1
          year = match[2].length === 2 ? 2000 + parseInt(match[2], 10) : parseInt(match[2], 10)
        }
      } else if (pattern.source.startsWith('(\\d{4})')) {
        // Year comes first
        year = parseInt(match[1], 10)
        month = parseInt(match[2], 10)
      }

      if (month && month >= 1 && month <= 12) {
        return {
          label,
          grain: 'month',
          year,
          period: month,
        }
      }
    }
  }

  return null
}

/**
 * Parse a year label like "2024", "FY2024", "FY 2024"
 */
function parseYearLabel(label: string): DatePeriod | null {
  const patterns = [
    /^(\d{4})$/,                  // 2024
    /FY\s*(\d{4})/i,              // FY2024, FY 2024
    /'(\d{2})$/,                  // '24
  ]

  for (const pattern of patterns) {
    const match = label.match(pattern)
    if (match) {
      const year = match[1].length === 2 ? 2000 + parseInt(match[1], 10) : parseInt(match[1], 10)

      if (year >= 1900 && year <= 2100) {
        return {
          label,
          grain: 'year',
          year,
        }
      }
    }
  }

  return null
}

/**
 * Parse a day label like "1/1/2025", "2025-01-01", "01/01/2025"
 */
function parseDayLabel(label: string): DatePeriod | null {
  const patterns = [
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/,  // M/D/YYYY, M-D-YYYY
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/,   // M/D/YY, M-D-YY
    /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/,   // YYYY-M-D, YYYY/M/D (ISO)
  ]

  for (const pattern of patterns) {
    const match = label.match(pattern)
    if (!match) continue

    let year: number, month: number, day: number

    if (pattern.source.startsWith('^(\\d{4})')) {
      // ISO format: YYYY-MM-DD
      year = parseInt(match[1], 10)
      month = parseInt(match[2], 10)
      day = parseInt(match[3], 10)
    } else {
      // US format: M/D/YYYY or M/D/YY
      month = parseInt(match[1], 10)
      day = parseInt(match[2], 10)
      const yearMatch = match[3]
      year = yearMatch.length === 2 ? 2000 + parseInt(yearMatch, 10) : parseInt(yearMatch, 10)
    }

    // Validate month and day ranges
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      continue
    }

    // Validate year range
    if (year < 1900 || year > 2100) {
      continue
    }

    try {
      const date = new Date(year, month - 1, day)
      // Check if the date is valid
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        continue
      }

      return {
        label,
        grain: 'day',
        year,
        period: month * 100 + day, // Store as MMDD for sorting
        startDate: date,
        endDate: date,
      }
    } catch {
      continue
    }
  }

  return null
}

/**
 * Parse a single date header label and determine its grain and period
 */
export function parseDateLabel(label: string): DatePeriod | null {
  const trimmed = label.trim()
  if (!trimmed) return null

  // Try parsing as different date formats (order matters - most specific first)
  return parseDayLabel(trimmed) ||
         parseQuarterLabel(trimmed) ||
         parseMonthLabel(trimmed) ||
         parseYearLabel(trimmed) ||
         null
}

function normalizePeriods(periods: DatePeriod[]): DatePeriod[] {
  if (periods.length === 0) return periods

  const allDayWithStart = periods.every(
    (period) => period.grain === 'day' && period.startDate instanceof Date,
  )

  if (allDayWithStart) {
    const allFirstOfMonth = periods.every(
      (period) => period.startDate!.getDate() === 1,
    )

    if (allFirstOfMonth) {
      return periods.map((period) => {
        const start = period.startDate!
        return {
          ...period,
          grain: 'month',
          period: start.getMonth() + 1,
        }
      })
    }
  }

  return periods
}

/**
 * Detect the time context from a row of column headers
 * @param headers Array of column header labels
 * @param startCol The column index where dates typically start (usually 1, after row labels)
 * @returns Detected time context or null if no pattern found
 */
export function detectTimeContext(
  headers: string[],
  startCol: number = 1
): DetectedTimeContext | null {
  const periods: DatePeriod[] = []

  // Parse each header starting from startCol
  for (let i = startCol; i < headers.length; i++) {
    const header = headers[i]
    if (!header) continue

    // Check if this looks like a total/summary column
    if (/total|sum|avg|average/i.test(header)) {
      continue // Skip summary columns
    }

    const parsed = parseDateLabel(header)
    if (parsed) {
      periods.push(parsed)
    } else if (periods.length > 0) {
      // If we found some periods but then hit a non-date column, stop
      break
    }
  }

  const normalizedPeriods = normalizePeriods(periods)

  // Require at least 3 consecutive periods to qualify as a date range
  if (normalizedPeriods.length < 3) {
    return null
  }

  // Determine the grain (should be consistent across all periods)
  const grains = new Set(normalizedPeriods.map(p => p.grain))
  if (grains.size > 1) {
    // Mixed grains - lower confidence or pick the most common one
    const grainCounts = Array.from(grains).map(g => ({
      grain: g,
      count: normalizedPeriods.filter(p => p.grain === g).length
    }))
    grainCounts.sort((a, b) => b.count - a.count)
    const dominantGrain = grainCounts[0].grain

    // Filter to only include dominant grain
    const filteredPeriods = normalizedPeriods.filter(p => p.grain === dominantGrain)

    return buildTimeContext(filteredPeriods, 'medium')
  }

  return buildTimeContext(normalizedPeriods, 'high')
}

/**
 * Build a time context object from parsed periods
 */
function buildTimeContext(periods: DatePeriod[], confidence: 'high' | 'medium' | 'low'): DetectedTimeContext | null {
  if (periods.length === 0) return null

  const grain = periods[0].grain
  const startPeriod = formatPeriod(periods[0])
  const endPeriod = formatPeriod(periods[periods.length - 1])

  return {
    grain,
    periods,
    startPeriod,
    endPeriod,
    confidence,
  }
}

/**
 * Format a date period as a string like "2024-Q1" or "2024-01"
 */
export function formatPeriod(period: DatePeriod): string {
  switch (period.grain) {
    case 'quarter':
      return `${period.year}-Q${period.period}`
    case 'month':
      return `${period.year}-${String(period.period).padStart(2, '0')}`
    case 'year':
      return `${period.year}`
    case 'day':
      if (period.startDate) {
        const month = period.startDate.getMonth() + 1
        const day = period.startDate.getDate()
        return `${period.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
      return period.label
    default:
      return period.label
  }
}

/**
 * Generate a human-readable description of the time context
 */
export function describeTimeContext(context: DetectedTimeContext): string {
  const grainLabel = context.grain === 'quarter' ? 'Quarter' :
                     context.grain === 'month' ? 'Monthly' :
                     context.grain === 'year' ? 'Annual' :
                     context.grain === 'week' ? 'Weekly' : 'Daily'

  return `${grainLabel} periods from ${context.startPeriod} to ${context.endPeriod}`
}

/**
 * Get the count description for the time context
 */
export function getTimeContextCount(context: DetectedTimeContext): string {
  const count = context.periods.length
  const unit = context.grain === 'quarter' ? 'quarter' :
               context.grain === 'month' ? 'month' :
               context.grain === 'year' ? 'year' :
               context.grain === 'week' ? 'week' : 'day'

  return `${count} ${unit}${count !== 1 ? 's' : ''}`
}

/**
 * Detect all date ranges across all rows in the grid
 * @param gridData The full grid data
 * @param previousRanges Previously detected ranges to check for new ones
 * @returns Array of detected date ranges with their row positions
 */
export function detectAllDateRanges(
  gridData: Array<Array<{ raw: string; display?: string }>>,
  previousRanges: DetectedDateRange[] = []
): DetectedDateRange[] {
  const ranges: DetectedDateRange[] = []
  const now = Date.now()

  // Create a map of previously detected ranges by row for quick lookup
  const previousByRow = new Map(previousRanges.map(r => [r.rowIndex, r]))

  gridData.forEach((row, rowIndex) => {
    // Use display value if available (for formula-computed values), otherwise use raw
    const headers = row.map(cell => cell.display ?? cell.raw || "")

    // Manually detect to track column positions
    const startCol = 1
    const periods: DatePeriod[] = []
    let firstDateCol = -1
    let lastDateCol = -1

    for (let i = startCol; i < headers.length; i++) {
      const header = headers[i]
      if (!header) continue

      if (/total|sum|avg|average/i.test(header)) {
        continue
      }

      const parsed = parseDateLabel(header)
      if (parsed) {
        if (firstDateCol === -1) firstDateCol = i
        lastDateCol = i
        periods.push(parsed)
      } else if (periods.length > 0) {
        break
      }
    }

    // Require at least 3 consecutive periods
    const normalizedPeriods = normalizePeriods(periods)
    if (normalizedPeriods.length >= 3 && firstDateCol !== -1) {
      const grain = normalizedPeriods[0].grain
      const startPeriod = formatPeriod(normalizedPeriods[0])
      const endPeriod = formatPeriod(normalizedPeriods[normalizedPeriods.length - 1])

      const context: DetectedTimeContext = {
        grain,
        periods: normalizedPeriods,
        startPeriod,
        endPeriod,
        confidence: 'high',
      }

      // Check if this is a new detection
      const previous = previousByRow.get(rowIndex)

      // Consider it new only if:
      // 1. There was no previous detection, OR
      // 2. The range characteristics changed (grain, start, or end period)
      // Once marked as not new (isNew: false), it stays that way
      const rangeChanged = !previous ||
                           previous.context.grain !== context.grain ||
                           previous.context.startPeriod !== context.startPeriod ||
                           previous.context.endPeriod !== context.endPeriod

      const isNew = rangeChanged ? true : (previous?.isNew ?? true)

      ranges.push({
        rowIndex,
        startCol: firstDateCol,
        endCol: lastDateCol,
        context,
        isNew,
        detectedAt: previous?.detectedAt || now,
      })
    }
  })

  return ranges
}

/**
 * Find the closest date range to the given row
 * @param ranges Array of detected date ranges
 * @param targetRow The row to find the closest range for
 * @returns The closest date range, or null if none found
 */
export function findClosestDateRange(
  ranges: DetectedDateRange[],
  targetRow: number
): DetectedDateRange | null {
  if (ranges.length === 0) return null

  // Find the range that's closest to the target row
  // Prefer ranges that are above the target row (header rows)
  let closest: DetectedDateRange | null = null
  let minDistance = Infinity

  for (const range of ranges) {
    // Distance calculation:
    // - If range is above target row: use direct distance
    // - If range is below target row: penalize it to prefer above
    const distance = range.rowIndex <= targetRow
      ? targetRow - range.rowIndex
      : (range.rowIndex - targetRow) + 1000 // Heavy penalty for rows below

    if (distance < minDistance) {
      minDistance = distance
      closest = range
    }
  }

  return closest
}
