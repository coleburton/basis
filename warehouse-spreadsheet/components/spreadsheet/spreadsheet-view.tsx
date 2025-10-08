"use client"

import { useEffect, useRef, useState } from "react"
import { FormulaBar } from "./formula-bar"
import { SpreadsheetToolbar } from "./spreadsheet-toolbar"
import { SpreadsheetGrid, type SpreadsheetGridHandle } from "./spreadsheet-grid"
import { PeriodSelector } from "./period-selector"
import { InsertMetricDialog } from "./insert-metric-dialog"
import { Button } from "@/components/ui/button"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { detectAllDateRanges, type DetectedDateRange } from "@/lib/date-detection"

interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  numberFormat?: 'general' | 'currency' | 'percentage' | 'text'
}

export function SpreadsheetView() {
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 })
  const [formula, setFormula] = useState("")
  const [isInsertMetricOpen, setIsInsertMetricOpen] = useState(false)
  const [isPeriodCollapsed, setIsPeriodCollapsed] = useState(false)
  const [currentFormat, setCurrentFormat] = useState<CellFormat | null>(null)
  const [detectedRanges, setDetectedRanges] = useState<DetectedDateRange[]>([])

  const gridRef = useRef<SpreadsheetGridHandle>(null)
  const formulaUpdateFromGrid = useRef(false)
  const detectedRangesRef = useRef<DetectedDateRange[]>([])

  // Detect date ranges whenever grid data changes
  useEffect(() => {
    const detectRanges = () => {
      const gridData = gridRef.current?.getGridData()
      if (gridData) {
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
    }

    // Run detection initially and whenever relevant changes occur
    detectRanges()

    // Set up periodic checking (every 500ms)
    const interval = setInterval(detectRanges, 500)

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
    gridRef.current?.setFormulaDraft(newFormula)
  }

  const handleFormulaCommit = () => {
    gridRef.current?.commitFormulaDraft(formula)
  }

  const handleFormulaCancel = () => {
    gridRef.current?.cancelFormulaDraft()
  }

  const handleFormulaFocus = () => {
    gridRef.current?.setFormulaDraft(formula)
  }

  const handleFormulaToggleAnchor = () => {
    gridRef.current?.toggleReferenceAnchor()
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

  const handleNumberFormat = (format: 'general' | 'currency' | 'percentage' | 'text') => {
    gridRef.current?.applyFormatting({ numberFormat: format })
    updateCurrentFormat()
  }

  const handleCellClickWrapper = (cell: { row: number; col: number }) => {
    setActiveCell(cell)
    updateCurrentFormat()
  }

  useEffect(() => {
    // Delay to ensure grid is fully initialized
    requestAnimationFrame(() => {
      updateCurrentFormat()
    })
  }, [activeCell])

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Toolbar */}
      <SpreadsheetToolbar
        onInsertMetric={() => setIsInsertMetricOpen(true)}
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
        {/* Left Sidebar - Period Selector */}
        <div
          className={cn(
            "relative border-r border-border bg-card transition-[width] duration-200 ease-in-out",
            isPeriodCollapsed ? "w-12" : "w-64"
          )}
        >
          <Button
            size="icon"
            variant="outline"
            className="absolute -right-3 top-4 z-20 h-6 w-6 rounded-full border-border bg-background shadow-sm"
            onClick={() => setIsPeriodCollapsed((prev) => !prev)}
          >
            {isPeriodCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
          {isPeriodCollapsed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Calendar className="h-5 w-5" />
              <span className="rotate-180 text-xs font-medium" style={{ writingMode: "vertical-rl" }}>
                Periods
              </span>
            </div>
          ) : (
            <PeriodSelector />
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
          />
        </div>
      </div>

      <InsertMetricDialog
        open={isInsertMetricOpen}
        onOpenChange={setIsInsertMetricOpen}
        gridData={gridRef.current?.getGridData()}
        activeCell={activeCell}
        detectedRanges={detectedRanges}
      />
    </div>
  )
}
