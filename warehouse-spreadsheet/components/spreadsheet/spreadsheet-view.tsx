"use client"

import { useEffect, useRef, useState } from "react"
import { FormulaBar } from "./formula-bar"
import { SpreadsheetToolbar } from "./spreadsheet-toolbar"
import { SpreadsheetGrid, type SpreadsheetGridHandle, type MetricRangeConfig } from "./spreadsheet-grid"
import { MetricsNavigator } from "./metrics-navigator"
import { InsertMetricDialog } from "./insert-metric-dialog"
import { Button } from "@/components/ui/button"
import { Database, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { detectAllDateRanges, type DetectedDateRange } from "@/lib/date-detection"

interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  numberFormat?: 'general' | 'currency' | 'percentage' | 'text' | 'date'
}

export function SpreadsheetView() {
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 })
  const [formula, setFormula] = useState("")
  const [isInsertMetricOpen, setIsInsertMetricOpen] = useState(false)
  const [isMetricsCollapsed, setIsMetricsCollapsed] = useState(false)
  const [currentFormat, setCurrentFormat] = useState<CellFormat | null>(null)
  const [detectedRanges, setDetectedRanges] = useState<DetectedDateRange[]>([])
  const [editingMetricRange, setEditingMetricRange] = useState<MetricRangeConfig | null>(null)
  const [metricRanges, setMetricRanges] = useState<Record<string, MetricRangeConfig>>({})
  const [metricCells, setMetricCells] = useState<Record<string, { value: number | string | null; loading: boolean; error: string | null }>>({})

  const gridRef = useRef<SpreadsheetGridHandle>(null)
  const formulaUpdateFromGrid = useRef(false)
  const detectedRangesRef = useRef<DetectedDateRange[]>([])
  const lastGridDataHashRef = useRef<string>("")

  // Update metrics data periodically
  useEffect(() => {
    const updateMetrics = () => {
      if (!gridRef.current) return
      const ranges = gridRef.current.getMetricRanges()
      const cells = gridRef.current.getMetricCells()
      setMetricRanges(ranges)
      setMetricCells(cells)
    }

    // Update initially
    updateMetrics()

    // Update every 500ms to keep in sync
    const interval = setInterval(updateMetrics, 500)

    return () => clearInterval(interval)
  }, [])

  // Detect date ranges whenever grid data changes
  useEffect(() => {
    const detectRanges = () => {
      const gridData = gridRef.current?.getGridData()
      if (!gridData) return

      // Early bailout: Check if grid data has actually changed
      // Use a simple hash of the first few cells to avoid expensive comparison
      const gridHash = gridData.slice(0, 10).map(row =>
        row.slice(0, 10).map(cell => cell.raw).join('|')
      ).join('||')

      if (gridHash === lastGridDataHashRef.current) {
        return
      }

      lastGridDataHashRef.current = gridHash

      const newRanges = detectAllDateRanges(gridData, detectedRangesRef.current)
      if (JSON.stringify(newRanges) !== JSON.stringify(detectedRangesRef.current)) {
        detectedRangesRef.current = newRanges
        setDetectedRanges(newRanges)

        // Set timeout to mark ranges as not new after 3 seconds
        setTimeout(() => {
          setDetectedRanges(prev => {
            const updated = prev.map(r => ({ ...r, isNew: false }))
            detectedRangesRef.current = updated
            return updated
          })
        }, 3000)
      }
    }

    // Run detection initially
    detectRanges()

    // Set up periodic checking (every 2 seconds instead of 500ms)
    const interval = setInterval(detectRanges, 2000)

    return () => clearInterval(interval)
  }, [])

  const handleGridFormulaChange = (value: string) => {
    formulaUpdateFromGrid.current = true
    setFormula(value)
  }

  useEffect(() => {
    if (formulaUpdateFromGrid.current) {
      formulaUpdateFromGrid.current = false
    }
  }, [formula])

  const handleCellChange = (row: number, col: number, value: string) => {
    console.log(`Cell [${row}, ${col}] changed to: ${value}`)
    // Here you would integrate with your formula engine or backend
  }

  const handleFormulaInputChange = (newFormula: string) => {
    setFormula(newFormula)
    if (formulaUpdateFromGrid.current) {
      return
    }
    gridRef.current?.setFormulaDraft(newFormula, { focusCell: false, source: 'formulaBar' })
  }

  const handleFormulaCommit = () => {
    gridRef.current?.commitFormulaDraft(formula)
  }

  const handleFormulaCancel = () => {
    gridRef.current?.cancelFormulaDraft()
  }

  const handleFormulaFocus = () => {
    gridRef.current?.setFormulaDraft(formula, { focusCell: false, source: 'formulaBar' })
  }

  const handleFormulaToggleAnchor = () => {
    gridRef.current?.toggleReferenceAnchor()
  }

  const handleEditMetricRange = (range: MetricRangeConfig) => {
    const clonedRange: MetricRangeConfig = {
      ...range,
      columns: [...range.columns],
      rows: range.rows.map(row => ({ ...row })),
      metadata: range.metadata ? JSON.parse(JSON.stringify(range.metadata)) : undefined,
    }
    setEditingMetricRange(clonedRange)
    setIsInsertMetricOpen(true)
    const firstCol = clonedRange.columns[0] ?? 0
    const firstRow = clonedRange.rows[0]?.row ?? 0
    setActiveCell({ row: firstRow, col: firstCol })
  }

  const updateCurrentFormat = () => {
    if (!gridRef.current) return
    const format = gridRef.current.getSelectionFormat()
    setCurrentFormat(format || null)
  }

  const handleBold = () => {
    const format = gridRef.current?.getSelectionFormat()
    gridRef.current?.applyFormatting({ bold: !format?.bold })
    updateCurrentFormat()
  }

  const handleItalic = () => {
    const format = gridRef.current?.getSelectionFormat()
    gridRef.current?.applyFormatting({ italic: !format?.italic })
    updateCurrentFormat()
  }

  const handleUnderline = () => {
    const format = gridRef.current?.getSelectionFormat()
    gridRef.current?.applyFormatting({ underline: !format?.underline })
    updateCurrentFormat()
  }

  const handleAlign = (align: 'left' | 'center' | 'right') => {
    gridRef.current?.applyFormatting({ align })
    updateCurrentFormat()
  }

  const handleNumberFormat = (format: 'general' | 'currency' | 'percentage' | 'text' | 'date') => {
    gridRef.current?.applyFormatting({ numberFormat: format })
    updateCurrentFormat()
  }

  const handleCellClickWrapper = (cell: { row: number; col: number }) => {
    setActiveCell(cell)
    // Defer format update to avoid blocking the navigation
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => updateCurrentFormat())
    } else {
      requestAnimationFrame(() => updateCurrentFormat())
    }
  }

  const handleNavigateToMetric = (range: MetricRangeConfig) => {
    // Navigate to the first cell of the metric range
    const firstCol = range.columns[0] ?? 0
    const firstRow = range.rows[0]?.row ?? 0
    setActiveCell({ row: firstRow, col: firstCol })

    // Focus the grid
    const cellRef = document.querySelector(`[data-cell="${firstRow},${firstCol}"]`)
    if (cellRef instanceof HTMLElement) {
      cellRef.focus()
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Toolbar */}
      <SpreadsheetToolbar
        onInsertMetric={() => {
          setEditingMetricRange(null)
          setIsInsertMetricOpen(true)
        }}
        onBold={handleBold}
        onItalic={handleItalic}
        onUnderline={handleUnderline}
        onAlign={handleAlign}
        onNumberFormat={handleNumberFormat}
        currentFormat={currentFormat}
      />

      {/* Formula Bar */}
      <FormulaBar
        activeCell={activeCell}
        formula={formula}
        onFormulaChange={handleFormulaInputChange}
        onFormulaCommit={handleFormulaCommit}
        onFormulaCancel={handleFormulaCancel}
        onFormulaFocus={handleFormulaFocus}
        onFormulaToggleAnchor={handleFormulaToggleAnchor}
      />

      {/* Main Spreadsheet Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Metrics Navigator */}
        <div
          className={cn(
            "relative border-r border-border bg-card transition-[width] duration-200 ease-in-out",
            isMetricsCollapsed ? "w-12" : "w-64"
          )}
        >
          <Button
            size="icon"
            variant="outline"
            className="absolute -right-3 top-4 z-20 h-6 w-6 rounded-full border-border bg-background shadow-sm"
            onClick={() => setIsMetricsCollapsed((prev) => !prev)}
          >
            {isMetricsCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          {isMetricsCollapsed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Database className="h-5 w-5" />
              <span className="rotate-180 text-xs font-medium" style={{ writingMode: "vertical-rl" }}>
                Metrics
              </span>
            </div>
          ) : (
            <MetricsNavigator
              metricRanges={metricRanges}
              metricCells={metricCells}
              onNavigateToMetric={handleNavigateToMetric}
            />
          )}
        </div>

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto">
        <SpreadsheetGrid
          ref={gridRef}
          activeCell={activeCell}
          onCellClick={handleCellClickWrapper}
          onCellChange={handleCellChange}
          onFormulaChange={handleGridFormulaChange}
          detectedRanges={detectedRanges}
          onEditMetricRange={handleEditMetricRange}
        />
        </div>
      </div>

      <InsertMetricDialog
        open={isInsertMetricOpen}
        onOpenChange={setIsInsertMetricOpen}
        gridData={gridRef.current?.getGridData()}
        activeCell={activeCell}
        detectedRanges={detectedRanges}
        gridRef={gridRef}
        editingRange={editingMetricRange}
        onClearEditingRange={() => setEditingMetricRange(null)}
      />
    </div>
  )
}
