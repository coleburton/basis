"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { FormulaBar } from "./formula-bar"
import { SpreadsheetToolbar } from "./spreadsheet-toolbar"
import { SpreadsheetGrid, type SpreadsheetGridHandle, type MetricRangeConfig } from "./spreadsheet-grid"
import { MetricsNavigator } from "./metrics-navigator"
import { InsertMetricDialog } from "./insert-metric-dialog"
import { SheetTabs } from "./sheet-tabs"
import { Button } from "@/components/ui/button"
import { Database, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { detectAllDateRanges, type DetectedDateRange } from "@/lib/date-detection"
import { useWorkbook, WorkbookProvider, type MetricCellResult } from "@/lib/workbook/workbook-context"

interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  numberFormat?: 'general' | 'currency' | 'percentage' | 'text' | 'date'
}

export function SpreadsheetView() {
  const searchParams = useSearchParams()
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 })
  const [formula, setFormula] = useState("")
  const [isInsertMetricOpen, setIsInsertMetricOpen] = useState(false)
  const [isMetricsCollapsed, setIsMetricsCollapsed] = useState(false)
  const [currentFormat, setCurrentFormat] = useState<CellFormat | null>(null)
  const [detectedRanges, setDetectedRanges] = useState<DetectedDateRange[]>([])
  const [editingMetricRange, setEditingMetricRange] = useState<MetricRangeConfig | null>(null)
  const [metricCells, setMetricCells] = useState<Record<string, MetricCellResult>>({})
  const [gridEditingState, setGridEditingState] = useState<{ isEditing: boolean; isFormula: boolean; sheetId: string | null }>({
    isEditing: false,
    isFormula: false,
    sheetId: null,
  })
  const workbookIdFromUrl = searchParams.get('id')

  // Manual save function
  const handleSave = async () => {
    if (!workbookId || !saveWorkbookData) return
    
    setSaving(true)
    try {
      await saveWorkbookData(workbookId)
      console.log('[SpreadsheetView] ✅ Saved successfully')
    } catch (error) {
      console.error('[SpreadsheetView] Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const gridRef = useRef<SpreadsheetGridHandle>(null)
  const formulaUpdateFromGrid = useRef(false)
  // Track detected ranges per sheet
  const detectedRangesBySheetRef = useRef<Record<string, DetectedDateRange[]>>({})
  const lastGridDataHashBySheetRef = useRef<Record<string, string>>({})

  // Update metric cells periodically (metricRanges come from activeSheet)
  useEffect(() => {
    const updateMetrics = () => {
      if (!gridRef.current) return
      const cells = gridRef.current.getMetricCells()
      setMetricCells(cells)
    }

    // Update initially
    updateMetrics()

    // Update every 500ms to keep in sync
    const interval = setInterval(updateMetrics, 500)

    return () => clearInterval(interval)
  }, [])

  // Pass refs down to inner component for date detection
  const detectRangesCallback = useCallback((sheetId: string) => {
    const gridDataWithDisplay = gridRef.current?.getGridDataWithDisplay()
    if (!gridDataWithDisplay || !sheetId) return

    // Early bailout: Check if grid data has actually changed for this sheet
    const gridHash = gridDataWithDisplay.slice(0, 10).map(row =>
      row.slice(0, 10).map(cell => cell.display).join('|')
    ).join('||')

    if (gridHash === lastGridDataHashBySheetRef.current[sheetId]) {
      return
    }

    lastGridDataHashBySheetRef.current[sheetId] = gridHash

    // Get previous ranges for this sheet
    const previousRanges = detectedRangesBySheetRef.current[sheetId] || []
    const newRanges = detectAllDateRanges(gridDataWithDisplay, previousRanges)

    if (JSON.stringify(newRanges) !== JSON.stringify(previousRanges)) {
      detectedRangesBySheetRef.current[sheetId] = newRanges
      setDetectedRanges(newRanges)

      // Set timeout to mark ranges as not new after 3 seconds
      setTimeout(() => {
        // Update the stored ranges for this sheet
        const currentRanges = detectedRangesBySheetRef.current[sheetId]
        if (currentRanges) {
          const updated = currentRanges.map(r => ({ ...r, isNew: false }))
          detectedRangesBySheetRef.current[sheetId] = updated

          // Update state to trigger re-render
          setDetectedRanges(updated)
        }
      }, 3000)
    } else {
      // Even if ranges haven't changed, update state in case we switched sheets
      setDetectedRanges(newRanges)
    }
  }, [])

  const handleGridFormulaChange = (value: string, _sheetId?: string) => {
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
    setFormula("")
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

  // Wrap the formula change handler to pass sheet context
  const wrappedHandleGridFormulaChange = useCallback((value: string) => {
    // We can't easily get activeSheet here since it's in WorkbookProvider
    // So we'll pass sheetId from the grid component
    handleGridFormulaChange(value)
  }, [])

  return (
    <WorkbookProvider initialWorkbookId={workbookIdFromUrl}>
      <SpreadsheetViewInner
        formula={formula}
        activeCell={activeCell}
        isInsertMetricOpen={isInsertMetricOpen}
        isMetricsCollapsed={isMetricsCollapsed}
        currentFormat={currentFormat}
        detectedRanges={detectedRanges}
        editingMetricRange={editingMetricRange}
        metricCells={metricCells}
        gridRef={gridRef}
        setIsInsertMetricOpen={setIsInsertMetricOpen}
        setIsMetricsCollapsed={setIsMetricsCollapsed}
        setEditingMetricRange={setEditingMetricRange}
        setActiveCell={setActiveCell}
        handleGridFormulaChange={wrappedHandleGridFormulaChange}
        handleFormulaInputChange={handleFormulaInputChange}
        handleFormulaCommit={handleFormulaCommit}
        handleFormulaCancel={handleFormulaCancel}
        handleFormulaFocus={handleFormulaFocus}
        handleFormulaToggleAnchor={handleFormulaToggleAnchor}
        handleCellChange={handleCellChange}
        handleEditMetricRange={handleEditMetricRange}
        handleNavigateToMetric={handleNavigateToMetric}
        handleBold={handleBold}
        handleItalic={handleItalic}
        handleUnderline={handleUnderline}
        handleAlign={handleAlign}
        handleNumberFormat={handleNumberFormat}
        updateCurrentFormat={updateCurrentFormat}
        handleCellClickWrapper={handleCellClickWrapper}
        gridEditingState={gridEditingState}
        onGridEditingStateChange={setGridEditingState}
        detectRangesCallback={detectRangesCallback}
      />
    </WorkbookProvider>
  )
}

interface SpreadsheetViewInnerProps {
  workbookId?: string
  saving: boolean
  hasUnsavedChanges: boolean
  handleSave: () => void
  formula: string
  activeCell: { row: number; col: number }
  isInsertMetricOpen: boolean
  isMetricsCollapsed: boolean
  currentFormat: CellFormat | null
  detectedRanges: DetectedDateRange[]
  editingMetricRange: MetricRangeConfig | null
  metricCells: Record<string, MetricCellResult>
  gridRef: React.RefObject<SpreadsheetGridHandle>
  setIsInsertMetricOpen: (value: boolean) => void
  setIsMetricsCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void
  setEditingMetricRange: (value: MetricRangeConfig | null) => void
  setActiveCell: (value: { row: number; col: number }) => void
  handleGridFormulaChange: (value: string) => void
  handleFormulaInputChange: (value: string) => void
  handleFormulaCommit: () => void
  handleFormulaCancel: () => void
  handleFormulaFocus: () => void
  handleFormulaToggleAnchor: () => void
  handleCellChange: (row: number, col: number, value: string) => void
  handleEditMetricRange: (range: MetricRangeConfig) => void
  handleNavigateToMetric: (range: MetricRangeConfig) => void
  handleBold: () => void
  handleItalic: () => void
  handleUnderline: () => void
  handleAlign: (align: 'left' | 'center' | 'right') => void
  handleNumberFormat: (format: 'general' | 'currency' | 'percentage' | 'text' | 'date') => void
  updateCurrentFormat: () => void
  handleCellClickWrapper: (cell: { row: number; col: number }) => void
  gridEditingState: { isEditing: boolean; isFormula: boolean; sheetId: string | null }
  onGridEditingStateChange: (state: { isEditing: boolean; isFormula: boolean; sheetId: string | null }) => void
  detectRangesCallback: (sheetId: string) => void
}

// Inner component that has access to WorkbookContext
function SpreadsheetViewInner(props: SpreadsheetViewInnerProps) {
  const { activeSheet, workbookName, saveStatus, saveWorkbook } = useWorkbook()

  // Get metric ranges from active sheet
  const metricRanges = activeSheet?.metricRanges ?? {}

  const {
    formula,
    activeCell,
    isInsertMetricOpen,
    isMetricsCollapsed,
    currentFormat,
    detectedRanges,
    editingMetricRange,
    metricCells,
    gridRef,
    setIsInsertMetricOpen,
    setIsMetricsCollapsed,
    setEditingMetricRange,
    setActiveCell,
    handleGridFormulaChange,
    handleFormulaInputChange,
    handleFormulaCommit,
    handleFormulaCancel,
    handleFormulaFocus,
    handleFormulaToggleAnchor,
    handleCellChange,
    handleEditMetricRange,
    handleNavigateToMetric,
    handleBold,
    handleItalic,
    handleUnderline,
    handleAlign,
    handleNumberFormat,
    updateCurrentFormat,
    handleCellClickWrapper,
    gridEditingState,
    onGridEditingStateChange,
    detectRangesCallback,
  } = props

  const isFormulaEditing = gridEditingState.isEditing && gridEditingState.isFormula

  // Detect date ranges for the active sheet
  useEffect(() => {
    if (!activeSheet?.id) return

    const detectRanges = () => {
      detectRangesCallback(activeSheet.id)
    }

    // Run detection initially
    detectRanges()

    // Set up periodic checking (every 2 seconds)
    const interval = setInterval(detectRanges, 2000)

    return () => clearInterval(interval)
  }, [activeSheet?.id, detectRangesCallback])

  const handleSheetMouseDown = useCallback((sheetId: string) => {
    if (isFormulaEditing) {
      gridRef.current?.preserveEditOnNextBlur()
    }
  }, [gridRef, isFormulaEditing])

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Toolbar */}
      <SpreadsheetToolbar
        saveStatus={saveStatus}
        onSave={saveWorkbook}
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
            onClick={() => setIsMetricsCollapsed((prev: boolean) => !prev)}
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
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <SpreadsheetGrid
              ref={gridRef}
              activeCell={activeCell}
              onCellClick={handleCellClickWrapper}
              onCellChange={handleCellChange}
              onFormulaChange={(value: string) => handleGridFormulaChange(value)}
              onEditingStateChange={onGridEditingStateChange}
              detectedRanges={detectedRanges}
              onEditMetricRange={handleEditMetricRange}
            />
          </div>

          {/* Sheet Tabs */}
          <SheetTabs
            isFormulaEditing={isFormulaEditing}
            onSheetMouseDown={handleSheetMouseDown}
          />
        </div>
      </div>

      <InsertMetricDialog
        open={isInsertMetricOpen}
        onOpenChange={setIsInsertMetricOpen}
        gridData={gridRef.current?.getGridDataWithDisplay()}
        activeCell={activeCell}
        detectedRanges={detectedRanges}
        gridRef={gridRef}
        editingRange={editingMetricRange}
        onClearEditingRange={() => setEditingMetricRange(null)}
      />
    </div>
  )
}
