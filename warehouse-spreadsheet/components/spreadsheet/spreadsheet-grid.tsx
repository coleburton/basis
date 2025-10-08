"use client"

import { useState, useEffect, useRef, KeyboardEvent, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { evaluateFormula, getFormulaDependencies } from "@/lib/formula/evaluator"

interface SpreadsheetGridProps {
  activeCell: { row: number; col: number }
  onCellClick: (cell: { row: number; col: number }) => void
  onCellChange?: (row: number, col: number, value: string) => void
  onFormulaChange?: (formula: string) => void
}

interface CellContent {
  raw: string // The raw value or formula
  computed?: string | number | null // The evaluated value (for formulas)
}

// Sample data for initial state
const initialData = [
  ["", "Q1 2024", "Q2 2024", "Q3 2024", "Q4 2024", "Total"],
  ["Revenue", "1,250,000", "1,380,000", "1,520,000", "1,680,000", "5,830,000"],
  ["Cost of Goods Sold", "450,000", "495,000", "545,000", "600,000", "2,090,000"],
  ["Gross Profit", "800,000", "885,000", "975,000", "1,080,000", "3,740,000"],
  ["Operating Expenses", "320,000", "335,000", "350,000", "365,000", "1,370,000"],
  ["EBITDA", "480,000", "550,000", "625,000", "715,000", "2,370,000"],
  ["", "", "", "", "", ""],
  ["Gross Margin %", "64.0%", "64.1%", "64.1%", "64.3%", "64.2%"],
  ["EBITDA Margin %", "38.4%", "39.9%", "41.1%", "42.6%", "40.7%"],
]

const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
const NUM_ROWS = 50

export function SpreadsheetGrid({
  activeCell,
  onCellClick,
  onCellChange,
  onFormulaChange
}: SpreadsheetGridProps) {
  // Initialize grid data with CellContent structure
  const [gridData, setGridData] = useState<CellContent[][]>(() => {
    const data: CellContent[][] = []
    for (let i = 0; i < NUM_ROWS; i++) {
      const row: CellContent[] = []
      for (let j = 0; j < columns.length; j++) {
        const raw = i < initialData.length ? initialData[i][j] : ""
        row.push({ raw })
      }
      data.push(row)
    }
    return data
  })

  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Get cell value for formula evaluation (stable reference)
  const getCellValueForFormula = useCallback((row: number, col: number): string | number | null => {
    const cell = gridData[row]?.[col]
    if (!cell) return null

    // If the cell has a computed value, return it
    if (cell.computed !== undefined) {
      return cell.computed
    }

    // Otherwise return the raw value
    const raw = cell.raw
    if (!raw) return null

    // Try to parse as number
    const num = parseFloat(raw.replace(/,/g, ''))
    if (!isNaN(num)) {
      return num
    }

    return raw
  }, [gridData])

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingCell])

  // Update formula bar when active cell changes
  useEffect(() => {
    const cell = gridData[activeCell.row]?.[activeCell.col]
    const cellValue = cell?.raw || ""
    if (onFormulaChange) {
      onFormulaChange(cellValue)
    }
  }, [activeCell, gridData, onFormulaChange])

  const handleCellDoubleClick = (row: number, col: number) => {
    const cell = gridData[row]?.[col]
    const value = cell?.raw || ""
    setEditingCell({ row, col })
    setEditValue(value)
  }

  const handleCellKeyDown = (e: KeyboardEvent, row: number, col: number) => {
    // Enter or F2 to start editing
    if (e.key === "Enter" && !editingCell) {
      e.preventDefault()
      handleCellDoubleClick(row, col)
    } else if (e.key === "F2" && !editingCell) {
      e.preventDefault()
      handleCellDoubleClick(row, col)
    }
    // Arrow keys for navigation (when not editing)
    else if (!editingCell) {
      switch (e.key) {
        case "ArrowUp":
          e.preventDefault()
          if (row > 0) onCellClick({ row: row - 1, col })
          break
        case "ArrowDown":
          e.preventDefault()
          if (row < NUM_ROWS - 1) onCellClick({ row: row + 1, col })
          break
        case "ArrowLeft":
          e.preventDefault()
          if (col > 0) onCellClick({ row, col: col - 1 })
          break
        case "ArrowRight":
          e.preventDefault()
          if (col < columns.length - 1) onCellClick({ row, col: col + 1 })
          break
        case "Delete":
        case "Backspace":
          e.preventDefault()
          updateCellValue(row, col, "")
          break
        default:
          // Start editing on any character key
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            setEditingCell({ row, col })
            setEditValue(e.key)
          }
      }
    }
  }

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      commitEdit()
      // Move down after Enter
      if (editingCell && editingCell.row < NUM_ROWS - 1) {
        onCellClick({ row: editingCell.row + 1, col: editingCell.col })
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      cancelEdit()
    } else if (e.key === "Tab") {
      e.preventDefault()
      commitEdit()
      // Move right after Tab
      if (editingCell && editingCell.col < columns.length - 1) {
        onCellClick({ row: editingCell.row, col: editingCell.col + 1 })
      }
    }
  }

  const commitEdit = () => {
    if (editingCell) {
      updateCellValue(editingCell.row, editingCell.col, editValue)
      setEditingCell(null)
    }
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue("")
  }

  const updateCellValue = (row: number, col: number, value: string) => {
    setGridData(prevData => {
      const newData = prevData.map(row => [...row])
      if (!newData[row]) {
        newData[row] = Array(columns.length).fill({ raw: "" })
      }

      // Store the raw value
      newData[row][col] = { raw: value }

      // If it's a formula, evaluate it immediately
      if (value.startsWith('=')) {
        try {
          const computed = evaluateFormula(value, getCellValueForFormula)
          newData[row][col] = { raw: value, computed }
        } catch (error) {
          console.error(`Error evaluating formula at [${row}, ${col}]:`, error)
          newData[row][col] = { raw: value, computed: '#ERROR!' }
        }
      }

      return newData
    })

    if (onCellChange) {
      onCellChange(row, col, value)
    }
    if (onFormulaChange && row === activeCell.row && col === activeCell.col) {
      onFormulaChange(value)
    }
  }

  const handleInputBlur = () => {
    commitEdit()
  }

  const getCellValue = (row: number, col: number) => {
    const cell = gridData[row]?.[col]
    if (!cell) return ""

    // Display the computed value if it exists, otherwise the raw value
    if (cell.computed !== undefined) {
      return String(cell.computed)
    }

    return cell.raw
  }

  const getRawCellValue = (row: number, col: number) => {
    return gridData[row]?.[col]?.raw || ""
  }

  return (
    <div className="relative">
      {/* Column Headers */}
      <div className="sticky top-0 z-20 flex border-b border-border bg-muted">
        <div className="flex h-8 w-12 shrink-0 items-center justify-center border-r border-border bg-muted" />
        {columns.map((col, idx) => (
          <div
            key={col}
            className="flex h-8 w-32 shrink-0 items-center justify-center border-r border-border bg-muted font-mono text-xs font-medium text-muted-foreground"
          >
            {col}
          </div>
        ))}
      </div>

      {/* Grid Rows */}
      <div className="relative">
        {Array.from({ length: NUM_ROWS }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex border-b border-border">
            {/* Row Number */}
            <div className="flex h-10 w-12 shrink-0 items-center justify-center border-r border-border bg-muted font-mono text-xs font-medium text-muted-foreground">
              {rowIdx + 1}
            </div>

            {/* Row Cells */}
            {columns.map((_, colIdx) => {
              const isActive = activeCell.row === rowIdx && activeCell.col === colIdx
              const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx
              const cellValue = getCellValue(rowIdx, colIdx)
              const isHeader = colIdx === 0 && cellValue !== ""
              const isNumeric = cellValue && /^[\d,]+$/.test(cellValue.replace(/[%$]/g, ""))
              const isPercentage = cellValue.includes("%")
              const isFormula = cellValue.startsWith("=")

              return (
                <div
                  key={colIdx}
                  onClick={() => onCellClick({ row: rowIdx, col: colIdx })}
                  onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                  onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    "flex h-10 w-32 shrink-0 cursor-cell items-center border-r border-border px-2 text-sm transition-colors relative",
                    isActive && "ring-2 ring-primary ring-inset z-10",
                    isHeader && "bg-muted font-medium text-foreground",
                    !isHeader && "bg-card text-foreground hover:bg-accent",
                    isNumeric && !isEditing && "justify-end font-mono",
                    isPercentage && "text-success",
                    isFormula && "text-primary font-mono",
                  )}
                >
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      onBlur={handleInputBlur}
                      className={cn(
                        "absolute inset-0 h-full w-full border-2 border-primary bg-card px-2 text-sm outline-none",
                        isNumeric && "text-right font-mono",
                      )}
                    />
                  ) : (
                    <span className="truncate">{cellValue}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
