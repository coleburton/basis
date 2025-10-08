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

export function SpreadsheetView() {
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 })
  const [formula, setFormula] = useState("")
  const [isInsertMetricOpen, setIsInsertMetricOpen] = useState(false)
  const [isPeriodCollapsed, setIsPeriodCollapsed] = useState(false)

  const gridRef = useRef<SpreadsheetGridHandle>(null)
  const formulaUpdateFromGrid = useRef(false)

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

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Toolbar */}
      <SpreadsheetToolbar onInsertMetric={() => setIsInsertMetricOpen(true)} />

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
            onCellClick={setActiveCell}
            onCellChange={handleCellChange}
            onFormulaChange={handleGridFormulaChange}
          />
        </div>
      </div>

      <InsertMetricDialog open={isInsertMetricOpen} onOpenChange={setIsInsertMetricOpen} />
    </div>
  )
}
