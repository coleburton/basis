"use client"

import { useState } from "react"
import { FormulaBar } from "./formula-bar"
import { SpreadsheetToolbar } from "./spreadsheet-toolbar"
import { SpreadsheetGrid } from "./spreadsheet-grid"
import { PeriodSelector } from "./period-selector"
import { InsertMetricDialog } from "./insert-metric-dialog"

export function SpreadsheetView() {
  const [activeCell, setActiveCell] = useState({ row: 0, col: 0 })
  const [formula, setFormula] = useState("")
  const [isInsertMetricOpen, setIsInsertMetricOpen] = useState(false)

  const handleCellChange = (row: number, col: number, value: string) => {
    console.log(`Cell [${row}, ${col}] changed to: ${value}`)
    // Here you would integrate with your formula engine or backend
  }

  const handleFormulaChange = (newFormula: string) => {
    setFormula(newFormula)
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Toolbar */}
      <SpreadsheetToolbar onInsertMetric={() => setIsInsertMetricOpen(true)} />

      {/* Formula Bar */}
      <FormulaBar activeCell={activeCell} formula={formula} onFormulaChange={handleFormulaChange} />

      {/* Main Spreadsheet Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Period Selector */}
        <div className="w-64 border-r border-border bg-card">
          <PeriodSelector />
        </div>

        {/* Spreadsheet Grid */}
        <div className="flex-1 overflow-auto">
          <SpreadsheetGrid
            activeCell={activeCell}
            onCellClick={setActiveCell}
            onCellChange={handleCellChange}
            onFormulaChange={handleFormulaChange}
          />
        </div>
      </div>

      <InsertMetricDialog open={isInsertMetricOpen} onOpenChange={setIsInsertMetricOpen} />
    </div>
  )
}
