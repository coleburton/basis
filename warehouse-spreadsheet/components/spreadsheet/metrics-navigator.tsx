"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Database, MapPin, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import type { MetricRangeConfig } from "./spreadsheet-grid"

interface MetricsNavigatorProps {
  metricRanges: Record<string, MetricRangeConfig>
  metricCells: Record<string, { value: number | string | null; loading: boolean; error: string | null }>
  onNavigateToMetric: (range: MetricRangeConfig) => void
}

const columnIndexToName = (index: number): string => {
  let current = index
  let name = ""

  do {
    const remainder = current % 26
    name = String.fromCharCode(65 + remainder) + name
    current = Math.floor(current / 26) - 1
  } while (current >= 0)

  return name
}

export function MetricsNavigator({ metricRanges, metricCells, onNavigateToMetric }: MetricsNavigatorProps) {
  const ranges = Object.values(metricRanges)

  const getMetricStatus = (range: MetricRangeConfig) => {
    const cells = range.rows.flatMap(row =>
      range.columns.map(col => metricCells[`${row.row},${col}`])
    ).filter(Boolean)

    if (cells.length === 0) return 'unknown'
    if (cells.some(cell => cell.loading)) return 'loading'
    if (cells.some(cell => cell.error)) return 'error'
    return 'success'
  }

  const getLocationString = (range: MetricRangeConfig) => {
    const startCol = columnIndexToName(Math.min(...range.columns))
    const endCol = columnIndexToName(Math.max(...range.columns))
    const startRow = Math.min(...range.rows.map(r => r.row)) + 1
    const endRow = Math.max(...range.rows.map(r => r.row)) + 1

    if (startCol === endCol && startRow === endRow) {
      return `${startCol}${startRow}`
    }
    return `${startCol}${startRow}:${endCol}${endRow}`
  }

  const getDimensionSummary = (range: MetricRangeConfig) => {
    const configs = range.metadata?.dimensionConfigs as Record<string, { mode: string; values: string[] }> | undefined
    if (!configs) return null

    const dimensions = Object.entries(configs)
    if (dimensions.length === 0) return null

    return dimensions.map(([dim, config]) => {
      if (config.mode === 'pivot') return `${dim}: Pivot`
      if (config.mode === 'total') return `${dim}: Total`
      if (config.mode === 'select' && config.values.length > 0) {
        return `${dim}: ${config.values.slice(0, 2).join(', ')}${config.values.length > 2 ? '...' : ''}`
      }
      return null
    }).filter(Boolean)
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Metrics in Workbook</h2>
        <p className="text-sm text-muted-foreground">
          {ranges.length} {ranges.length === 1 ? 'metric' : 'metrics'} inserted
        </p>
      </div>

      {ranges.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <Database className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-sm font-medium mb-1">No metrics yet</p>
          <p className="text-xs text-muted-foreground">
            Insert a metric to start tracking data
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-3">
            {ranges.map((range) => {
              const status = getMetricStatus(range)
              const location = getLocationString(range)
              const dimensions = getDimensionSummary(range)

              return (
                <Button
                  key={range.id}
                  variant="outline"
                  onClick={() => onNavigateToMetric(range)}
                  className="w-full h-auto p-3 flex flex-col items-start gap-2 hover:bg-accent"
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Database className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 text-left">
                        <div className="font-medium text-sm truncate">
                          {range.displayName || range.metricId}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground font-mono">
                            {location}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {status === 'loading' && (
                        <Badge variant="outline" className="gap-1.5">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Loading
                        </Badge>
                      )}
                      {status === 'error' && (
                        <Badge variant="destructive" className="gap-1.5">
                          <AlertCircle className="h-3 w-3" />
                          Error
                        </Badge>
                      )}
                      {status === 'success' && (
                        <Badge variant="outline" className="gap-1.5 border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready
                        </Badge>
                      )}
                    </div>
                  </div>

                  {dimensions && dimensions.length > 0 && (
                    <div className="flex flex-wrap gap-1 w-full">
                      {dimensions.map((dim, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs font-normal">
                          {dim}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
