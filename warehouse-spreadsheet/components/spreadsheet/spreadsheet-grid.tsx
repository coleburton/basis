"use client"

import {
  useState,
  useEffect,
  useRef,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ClipboardEvent as ReactClipboardEvent,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react"
import { HyperFormula, DetailedCellError, type CellValue, type SimpleCellAddress } from "hyperformula"
import { parseFormula } from "@/lib/formula/parser"
import { cn } from "@/lib/utils"

interface SpreadsheetGridProps {
  activeCell: { row: number; col: number }
  onCellClick: (cell: { row: number; col: number }) => void
  onCellChange?: (row: number, col: number, value: string) => void
  onFormulaChange?: (formula: string) => void
}

interface CellContent {
  raw: string // The raw value or formula
}

export interface SpreadsheetGridHandle {
  setFormulaDraft: (value: string) => void
  commitFormulaDraft: (value: string) => void
  cancelFormulaDraft: () => void
  toggleReferenceAnchor: () => void
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
const REFERENCE_COLORS = ["#2563eb", "#dc2626", "#10b981", "#f97316"]

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

const getCellAddress = (row: number, col: number): string => {
  return `${columnIndexToName(col)}${row + 1}`
}

const columnNameToIndex = (name: string): number => {
  const normalized = name.replace(/\$/g, "").toUpperCase()
  let result = 0
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i)
    if (code < 65 || code > 90) continue
    result = result * 26 + (code - 64)
  }
  return result - 1
}

const cellRefToCoords = (ref: string): { row: number; col: number } | null => {
  const match = ref.match(/^\$?([A-Z]+)\$?(\d+)$/i)
  if (!match) return null
  const [, colLetters, rowNumber] = match
  const col = columnNameToIndex(colLetters)
  const row = parseInt(rowNumber.replace(/\$/g, ""), 10) - 1
  if (Number.isNaN(row) || col < 0) return null
  return { row, col }
}

interface ReferenceHighlight {
  start: { row: number; col: number }
  end: { row: number; col: number }
  color: string
}

interface CellRange {
  start: { row: number; col: number }
  end: { row: number; col: number }
}

const DEFAULT_COLUMN_WIDTH = 128
const DEFAULT_ROW_HEIGHT = 40
const MIN_COLUMN_WIDTH = 60
const MIN_ROW_HEIGHT = 24

const extractFormulaHighlights = (formula: string): ReferenceHighlight[] => {
  if (!formula.startsWith("=")) return []
  const pattern = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/gi
  const matches = formula.match(pattern) || []
  const highlights: ReferenceHighlight[] = []

  matches.forEach((token, idx) => {
    const [startRef, endRef] = token.split(":")
    const startCoords = cellRefToCoords(startRef)
    const endCoords = endRef ? cellRefToCoords(endRef) : startCoords
    if (!startCoords || !endCoords) return

    highlights.push({
      start: {
        row: Math.min(startCoords.row, endCoords.row),
        col: Math.min(startCoords.col, endCoords.col),
      },
      end: {
        row: Math.max(startCoords.row, endCoords.row),
        col: Math.max(startCoords.col, endCoords.col),
      },
      color: REFERENCE_COLORS[idx % REFERENCE_COLORS.length],
    })
  })

  return highlights
}

const normalizeRange = (a: { row: number; col: number }, b: { row: number; col: number }) => {
  return {
    start: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
    end: { row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) },
  }
}

const isCellInRange = (
  range: { start: { row: number; col: number }; end: { row: number; col: number } },
  row: number,
  col: number,
) => {
  return row >= range.start.row && row <= range.end.row && col >= range.start.col && col <= range.end.col
}

const ANCHOR_STATES = [
  { col: false, row: false },
  { col: true, row: true },
  { col: false, row: true },
  { col: true, row: false },
]

const parseCellReference = (reference: string) => {
  const match = reference.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/i)
  if (!match) return null
  const [, colAnchorToken, columnLetters, rowAnchorToken, rowNumbers] = match
  return {
    column: columnLetters.toUpperCase(),
    row: rowNumbers,
    colAnchored: colAnchorToken === "$",
    rowAnchored: rowAnchorToken === "$",
  }
}

const getAnchorStateIndex = (colAnchored: boolean, rowAnchored: boolean) => {
  return ANCHOR_STATES.findIndex((state) => state.col === colAnchored && state.row === rowAnchored)
}

const formatCellReference = (column: string, row: string, stateIndex: number) => {
  const state = ANCHOR_STATES[stateIndex]
  const colPart = state.col ? `$${column}` : column
  const rowPart = state.row ? `$${row}` : row
  return `${colPart}${rowPart}`
}

const cycleReferenceToken = (token: string) => {
  const [startRef, endRef] = token.split(":")
  const parsedStart = parseCellReference(startRef)
  if (!parsedStart) return null
  const currentIndex = getAnchorStateIndex(parsedStart.colAnchored, parsedStart.rowAnchored)
  const nextIndex = ((currentIndex + 1) % ANCHOR_STATES.length + ANCHOR_STATES.length) % ANCHOR_STATES.length
  const nextStart = formatCellReference(parsedStart.column, parsedStart.row, nextIndex)

  if (!endRef) {
    return nextStart
  }

  const parsedEnd = parseCellReference(endRef)
  if (!parsedEnd) return null
  const nextEnd = formatCellReference(parsedEnd.column, parsedEnd.row, nextIndex)
  return `${nextStart}:${nextEnd}`
}

const cycleReferenceInFormula = (
  formula: string,
  selectionStart: number,
  selectionEnd: number,
) => {
  const caret = Math.min(selectionStart, selectionEnd)
  const pattern = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(formula)) !== null) {
    const startIdx = match.index
    if (startIdx === undefined) {
      continue
    }
    const endIdx = startIdx + match[0].length
    if (caret < startIdx || caret > endIdx) {
      // If caret is exactly at end and selection is zero-length, allow toggling the previous token
      if (!(caret === endIdx && selectionStart === selectionEnd)) {
        continue
      }
    }

    const cycled = cycleReferenceToken(match[0])
    if (!cycled) return null

    const before = formula.slice(0, startIdx)
    const after = formula.slice(endIdx)
    const nextFormula = `${before}${cycled}${after}`
    const newSelectionStart = startIdx
    const newSelectionEnd = startIdx + cycled.length
    return { value: nextFormula, selectionStart: newSelectionStart, selectionEnd: newSelectionEnd }
  }

  return null
}

export const adjustFormulaReferences = (
  formula: string,
  rowOffset: number,
  colOffset: number,
) => {
  if (!formula.startsWith("=")) return formula
  const parsed = parseFormula(formula)
  if (parsed.type !== "formula" || !parsed.value) {
    return formula
  }

  const pattern = /\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?/g
  return formula.replace(pattern, (token) => {
    const [startRef, endRef] = token.split(":")
    const parsedStart = parseCellReference(startRef)
    if (!parsedStart) return token

    const parseRowNumber = (value: string) => parseInt(value, 10)

    const adjustCoordinate = (
      column: string,
      row: string,
      colAnchored: boolean,
      rowAnchored: boolean,
    ) => {
      const colIndex = columnNameToIndex(column)
      const rowIndex = parseRowNumber(row) - 1
      const nextColIndex = colAnchored ? colIndex : colIndex + colOffset
      const nextRowIndex = rowAnchored ? rowIndex : rowIndex + rowOffset
      const nextColumn = columnIndexToName(Math.max(0, nextColIndex))
      const nextRow = String(Math.max(0, nextRowIndex) + 1)
      const colPrefix = colAnchored ? "$" : ""
      const rowPrefix = rowAnchored ? "$" : ""
      return `${colPrefix}${nextColumn}${rowPrefix}${nextRow}`
    }

    const adjustedStart = adjustCoordinate(
      parsedStart.column,
      parsedStart.row,
      parsedStart.colAnchored,
      parsedStart.rowAnchored,
    )

    if (!endRef) {
      return adjustedStart
    }

    const parsedEnd = parseCellReference(endRef)
    if (!parsedEnd) return token

    const adjustedEnd = adjustCoordinate(
      parsedEnd.column,
      parsedEnd.row,
      parsedEnd.colAnchored,
      parsedEnd.rowAnchored,
    )

    return `${adjustedStart}:${adjustedEnd}`
  })
}

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

const normalizeValueForEngine = (value: string): string | number | null => {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("=")) return trimmed

  if (trimmed.endsWith("%")) {
    const numeric = Number(trimmed.slice(0, -1).replace(/[$,]/g, ""))
    return Number.isNaN(numeric) ? value : numeric / 100
  }

  const sanitized = trimmed.replace(/[$,]/g, "")
  const numeric = Number(sanitized)
  return Number.isNaN(numeric) ? value : numeric
}

const createInitialGridData = (): CellContent[][] => {
  const data: CellContent[][] = []
  for (let i = 0; i < NUM_ROWS; i++) {
    const row: CellContent[] = []
    for (let j = 0; j < columns.length; j++) {
      const raw = initialData[i]?.[j] ?? ""
      row.push({ raw })
    }
    data.push(row)
  }
  return data
}

export const SpreadsheetGrid = forwardRef<SpreadsheetGridHandle, SpreadsheetGridProps>(function SpreadsheetGrid({
  activeCell,
  onCellClick,
  onCellChange,
  onFormulaChange
}: SpreadsheetGridProps, ref) {
  const initialGrid = useMemo(() => createInitialGridData(), [])
  const [gridData, setGridData] = useState<CellContent[][]>(initialGrid)
  const hyperFormulaRef = useRef<HyperFormula | null>(null)
  const sheetIdRef = useRef<number>(0)
  const cellRefs = useRef<HTMLDivElement[][]>([])
  const [columnWidths, setColumnWidths] = useState<number[]>(() => Array(columns.length).fill(DEFAULT_COLUMN_WIDTH))
  const [rowHeights, setRowHeights] = useState<number[]>(() => Array(NUM_ROWS).fill(DEFAULT_ROW_HEIGHT))

  const [selectedRanges, setSelectedRanges] = useState<CellRange[]>(() => [
    { start: { row: activeCell.row, col: activeCell.col }, end: { row: activeCell.row, col: activeCell.col } },
  ])
  const selectionAnchorRef = useRef<{ row: number; col: number }>({ row: activeCell.row, col: activeCell.col })
  const suppressSelectionSyncRef = useRef(false)
  const selectionDraggingRef = useRef(false)
  const clipboardDataRef = useRef<{
    origin: { row: number; col: number }
    cells: { raw: string; display: string }[][]
    text: string
    rowCount: number
    colCount: number
  } | null>(null)

  const columnResizeState = useRef<{ index: number; startX: number; startWidth: number } | null>(null)
  const rowResizeState = useRef<{ index: number; startY: number; startHeight: number } | null>(null)

  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const [functionNames, setFunctionNames] = useState<string[]>([])
  const [functionSuggestions, setFunctionSuggestions] = useState<string[]>([])
  const [highlightedSuggestion, setHighlightedSuggestion] = useState(0)
  const [referencePreview, setReferencePreview] = useState<{
    start: { row: number; col: number }
    end: { row: number; col: number }
  } | null>(null)
  const pendingReferenceRef = useRef<{
    startIndex: number
    endIndex: number
    anchor: { row: number; col: number }
  } | null>(null)
  const referenceSelectionActiveRef = useRef(false)
  const keyboardReferenceCursorRef = useRef<{ row: number; col: number } | null>(null)

  const numberFormatter = useMemo(() => {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 4,
    })
  }, [])

  const percentFormatter = useMemo(() => {
    return new Intl.NumberFormat("en-US", {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    })
  }, [])

  const referenceHighlights = useMemo<ReferenceHighlight[]>(() => {
    if (!editingCell) return []
    const currentValue = editValue
    if (!currentValue.startsWith("=")) return []
    return extractFormulaHighlights(currentValue)
  }, [editValue, editingCell])

  const previewHighlight = useMemo<ReferenceHighlight | null>(() => {
    if (!referencePreview) return null
    const color = REFERENCE_COLORS[referenceHighlights.length % REFERENCE_COLORS.length]
    return {
      start: referencePreview.start,
      end: referencePreview.end,
      color,
    }
  }, [referenceHighlights.length, referencePreview])

  const applySelection = useCallback((ranges: CellRange[], anchor?: { row: number; col: number }) => {
    if (anchor) {
      selectionAnchorRef.current = anchor
    }
    setSelectedRanges(ranges)
  }, [])

  const selectSingleCell = useCallback((row: number, col: number) => {
    applySelection([{ start: { row, col }, end: { row, col } }], { row, col })
  }, [applySelection])

  const extendSelectionTo = useCallback((row: number, col: number) => {
    const anchor = selectionAnchorRef.current || { row, col }
    applySelection([normalizeRange(anchor, { row, col })])
  }, [applySelection])

  const addCellToSelection = useCallback((row: number, col: number) => {
    setSelectedRanges((prev) => {
      const cellRange = { start: { row, col }, end: { row, col } }
      const exists = prev.some((range) => isCellInRange(range, row, col))
      if (exists) return prev
      return [...prev, cellRange]
    })
    selectionAnchorRef.current = { row, col }
  }, [])

  const stopSelectionDragging = useCallback(() => {
    selectionDraggingRef.current = false
    window.removeEventListener("mouseup", stopSelectionDragging)
  }, [])

  useEffect(() => {
    return () => {
      window.removeEventListener("mouseup", stopSelectionDragging)
    }
  }, [stopSelectionDragging])

  const getSelectionEnvelope = useCallback(() => {
    let minRow = Number.POSITIVE_INFINITY
    let minCol = Number.POSITIVE_INFINITY
    let maxRow = Number.NEGATIVE_INFINITY
    let maxCol = Number.NEGATIVE_INFINITY

    selectedRanges.forEach((range) => {
      minRow = Math.min(minRow, range.start.row)
      minCol = Math.min(minCol, range.start.col)
      maxRow = Math.max(maxRow, range.end.row)
      maxCol = Math.max(maxCol, range.end.col)
    })

    if (!Number.isFinite(minRow) || !Number.isFinite(minCol)) {
      return null
    }

    return {
      start: { row: minRow, col: minCol },
      end: { row: maxRow, col: maxCol },
    }
  }, [selectedRanges])


  const handleColumnResizeMove = useCallback((event: MouseEvent) => {
    const state = columnResizeState.current
    if (!state) return
    const delta = event.clientX - state.startX
    const nextWidth = Math.max(MIN_COLUMN_WIDTH, state.startWidth + delta)
    setColumnWidths((prev) => {
      if (prev[state.index] === nextWidth) return prev
      const copy = [...prev]
      copy[state.index] = nextWidth
      return copy
    })
  }, [])

  const handleColumnResizeEnd = useCallback(() => {
    columnResizeState.current = null
    window.removeEventListener("mousemove", handleColumnResizeMove)
    window.removeEventListener("mouseup", handleColumnResizeEnd)
  }, [handleColumnResizeMove])

  const handleRowResizeMove = useCallback((event: MouseEvent) => {
    const state = rowResizeState.current
    if (!state) return
    const delta = event.clientY - state.startY
    const nextHeight = Math.max(MIN_ROW_HEIGHT, state.startHeight + delta)
    setRowHeights((prev) => {
      if (prev[state.index] === nextHeight) return prev
      const copy = [...prev]
      copy[state.index] = nextHeight
      return copy
    })
  }, [])

  const handleRowResizeEnd = useCallback(() => {
    rowResizeState.current = null
    window.removeEventListener("mousemove", handleRowResizeMove)
    window.removeEventListener("mouseup", handleRowResizeEnd)
  }, [handleRowResizeMove])

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleColumnResizeMove)
      window.removeEventListener("mouseup", handleColumnResizeEnd)
      window.removeEventListener("mousemove", handleRowResizeMove)
      window.removeEventListener("mouseup", handleRowResizeEnd)
    }
  }, [handleColumnResizeEnd, handleColumnResizeMove, handleRowResizeEnd, handleRowResizeMove])

  const startColumnResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, index: number) => {
      event.preventDefault()
      event.stopPropagation()
      columnResizeState.current = {
        index,
        startX: event.clientX,
        startWidth: columnWidths[index],
      }
      window.addEventListener("mousemove", handleColumnResizeMove)
      window.addEventListener("mouseup", handleColumnResizeEnd)
    },
    [columnWidths, handleColumnResizeEnd, handleColumnResizeMove]
  )

  const startRowResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>, index: number) => {
      event.preventDefault()
      event.stopPropagation()
      rowResizeState.current = {
        index,
        startY: event.clientY,
        startHeight: rowHeights[index],
      }
      window.addEventListener("mousemove", handleRowResizeMove)
      window.addEventListener("mouseup", handleRowResizeEnd)
    },
    [handleRowResizeEnd, handleRowResizeMove, rowHeights]
  )

  useEffect(() => {
    const sheetData = initialGrid.map(row => row.map(cell => normalizeValueForEngine(cell.raw)))
    const hf = HyperFormula.buildFromArray(sheetData, { licenseKey: "gpl-v3" })

    hyperFormulaRef.current = hf
    const [firstSheet] = hf.getSheetNames()
    sheetIdRef.current = firstSheet ? hf.getSheetId(firstSheet) ?? 0 : 0
    const availableFunctions = hf.getRegisteredFunctionNames().sort()
    setFunctionNames(availableFunctions)

    return () => {
      hf.destroy()
      hyperFormulaRef.current = null
    }
  }, [initialGrid])

  useEffect(() => {
    if (suppressSelectionSyncRef.current) {
      suppressSelectionSyncRef.current = false
      return
    }
    selectionAnchorRef.current = { row: activeCell.row, col: activeCell.col }
    setSelectedRanges([
      {
        start: { row: activeCell.row, col: activeCell.col },
        end: { row: activeCell.row, col: activeCell.col },
      },
    ])
  }, [activeCell.col, activeCell.row])

  // Focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    } else {
      const target = cellRefs.current[activeCell.row]?.[activeCell.col]
      target?.focus()
    }
  }, [activeCell, editingCell])

  // Update formula bar when active cell changes
  useEffect(() => {
    const cell = gridData[activeCell.row]?.[activeCell.col]
    const cellValue = cell?.raw || ""
    if (onFormulaChange) {
      onFormulaChange(cellValue)
    }
  }, [activeCell, gridData, onFormulaChange])

  useEffect(() => {
    if (
      editingCell &&
      editingCell.row === activeCell.row &&
      editingCell.col === activeCell.col &&
      onFormulaChange
    ) {
      onFormulaChange(editValue)
    }
  }, [activeCell, editValue, editingCell, onFormulaChange])

  const getEngineValue = useCallback(
    (row: number, col: number): CellValue | null => {
      const hf = hyperFormulaRef.current
      if (!hf) return null

      const address: SimpleCellAddress = { sheet: sheetIdRef.current, row, col }
      try {
        return hf.getCellValue(address)
      } catch (error) {
        console.error(`HyperFormula getCellValue failed at [${row}, ${col}]:`, error)
        return null
      }
    },
    []
  )

  const formatComputedValue = useCallback(
    (row: number, value: CellValue | null): string => {
      if (value === null) return ""
      if (value instanceof DetailedCellError) {
        return value.value ?? value.message ?? "#ERROR!"
      }
      if (typeof value === "number") {
        const rowHeader = gridData[row]?.[0]?.raw ?? ""
        if (rowHeader.includes("%")) {
          return percentFormatter.format(value)
        }
        return numberFormatter.format(value)
      }
      return String(value)
    },
    [gridData, numberFormatter, percentFormatter]
  )

  const getCellDisplayValue = useCallback(
    (row: number, col: number): string => {
      const rawValue = gridData[row]?.[col]?.raw ?? ""
      if (rawValue.startsWith("=")) {
        const engineValue = getEngineValue(row, col)
        return engineValue === null ? "" : formatComputedValue(row, engineValue)
      }
      return rawValue
    },
    [formatComputedValue, getEngineValue, gridData]
  )

  const updateCellValue = useCallback((row: number, col: number, value: string) => {
    const hf = hyperFormulaRef.current
    const address: SimpleCellAddress = { sheet: sheetIdRef.current, row, col }

    if (hf) {
      try {
        const normalized = normalizeValueForEngine(value)
        hf.setCellContents(address, normalized)
      } catch (error) {
        console.error(`HyperFormula setCellContents failed at [${row}, ${col}]:`, error)
      }
    }

    setGridData(prevData => {
      const newData = prevData.map(rowArr => [...rowArr])
      if (!newData[row]) {
        newData[row] = Array.from({ length: columns.length }, () => ({ raw: "" }))
      }

      newData[row][col] = { raw: value }
      return newData
    })

    if (onCellChange) {
      onCellChange(row, col, value)
    }
    if (onFormulaChange && row === activeCell.row && col === activeCell.col) {
      onFormulaChange(value)
    }
  }, [activeCell.col, activeCell.row, onCellChange, onFormulaChange])

  const copySelection = useCallback(
    async (event?: ReactClipboardEvent<HTMLDivElement>) => {
      const envelope = getSelectionEnvelope()
      if (!envelope) return

      const rowCount = envelope.end.row - envelope.start.row + 1
      const colCount = envelope.end.col - envelope.start.col + 1

      const cells: { raw: string; display: string }[][] = []
      const lines: string[] = []

      for (let r = 0; r < rowCount; r++) {
        const rowIndex = envelope.start.row + r
        const rowCells: { raw: string; display: string }[] = []
        const parts: string[] = []
        for (let c = 0; c < colCount; c++) {
          const colIndex = envelope.start.col + c
          const raw = gridData[rowIndex]?.[colIndex]?.raw ?? ""
          const display = getCellDisplayValue(rowIndex, colIndex)
          rowCells.push({ raw, display })
          parts.push(raw.startsWith("=") ? raw : display)
        }
        cells.push(rowCells)
        lines.push(parts.join("\t"))
      }

      const text = lines.join("\n")
      clipboardDataRef.current = {
        origin: envelope.start,
        cells,
        text,
        rowCount,
        colCount,
      }

      if (event?.clipboardData) {
        event.clipboardData.setData("text/plain", text)
        event.preventDefault()
      } else if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text)
        } catch (error) {
          console.error("Failed to write clipboard", error)
        }
      }
    },
    [getCellDisplayValue, getSelectionEnvelope, gridData]
  )

  const pasteFromClipboard = useCallback(
    async (event?: ReactClipboardEvent<HTMLDivElement>) => {
      let text = ""
      if (event?.clipboardData) {
        text = event.clipboardData.getData("text/plain")
        event.preventDefault()
      } else if (navigator.clipboard?.readText) {
        try {
          text = await navigator.clipboard.readText()
        } catch (error) {
          console.error("Failed to read clipboard", error)
          return
        }
      }

      if (!text) return

      const normalized = text.replace(/\r\n?/g, "\n")
      const rows = normalized.split("\n")
      const matrix = rows.map((row) => row.split("\t"))
      const rowCount = matrix.length
      const colCount = matrix.reduce((max, row) => Math.max(max, row.length), 0)
      if (rowCount === 0 || colCount === 0) return

      const target = selectionAnchorRef.current || { row: activeCell.row, col: activeCell.col }
      const meta = clipboardDataRef.current
      const isInternal = meta && meta.text === normalized

      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
          const destRow = target.row + r
          const destCol = target.col + c
          if (destRow >= NUM_ROWS || destCol >= columns.length) continue

          let value = matrix[r]?.[c] ?? ""

          if (isInternal && meta) {
            const cellData = meta.cells[r]?.[c]
            if (cellData) {
              if (cellData.raw.startsWith("=")) {
                value = adjustFormulaReferences(
                  cellData.raw,
                  destRow - meta.origin.row,
                  destCol - meta.origin.col,
                )
              } else {
                value = cellData.display
              }
            }
          }

          updateCellValue(destRow, destCol, value)
        }
      }

      const endRow = Math.min(NUM_ROWS - 1, target.row + rowCount - 1)
      const endCol = Math.min(columns.length - 1, target.col + colCount - 1)
      suppressSelectionSyncRef.current = true
      applySelection([normalizeRange(target, { row: endRow, col: endCol })], target)
      onCellClick(target)
    },
    [activeCell.col, activeCell.row, applySelection, onCellClick, updateCellValue]
  )

  const cutSelection = useCallback(
    async (event?: ReactClipboardEvent<HTMLDivElement>) => {
      await copySelection(event)
      const envelope = getSelectionEnvelope()
      if (!envelope) return

      for (let row = envelope.start.row; row <= envelope.end.row; row++) {
        for (let col = envelope.start.col; col <= envelope.end.col; col++) {
          updateCellValue(row, col, "")
        }
      }
    },
    [copySelection, getSelectionEnvelope, updateCellValue]
  )

  const handleCopyEvent = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      if (editingCell) return
      void copySelection(event)
    },
    [copySelection, editingCell]
  )

  const handlePasteEvent = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      if (editingCell) return
      void pasteFromClipboard(event)
    },
    [editingCell, pasteFromClipboard]
  )

  const handleCutEvent = useCallback(
    (event: ReactClipboardEvent<HTMLDivElement>) => {
      if (editingCell) return
      void cutSelection(event)
    },
    [cutSelection, editingCell]
  )

  const computeFunctionSuggestions = useCallback(
    (value: string) => {
      if (!editingCell || !value.startsWith("=")) {
        setFunctionSuggestions([])
        return
      }

      const input = inputRef.current
      const caret = input ? input.selectionStart ?? value.length : value.length
      const textBeforeCaret = value.slice(0, caret)
      const tokenMatch = textBeforeCaret.match(/([A-Za-z]+)$/)

      if (!tokenMatch) {
        setFunctionSuggestions([])
        return
      }

      const token = tokenMatch[1]
      const tokenStart = caret - token.length

      if (tokenStart > 0) {
        const prevChar = value[tokenStart - 1]
        if (prevChar && /[A-Za-z0-9]/.test(prevChar)) {
          setFunctionSuggestions([])
          return
        }
      }

      const upperToken = token.toUpperCase()
      if (!upperToken) {
        setFunctionSuggestions([])
        return
      }

      const matches = functionNames.filter(name => name.startsWith(upperToken)).slice(0, 8)

      if (matches.length === 0) {
        setFunctionSuggestions([])
        return
      }

      setFunctionSuggestions(matches)
      setHighlightedSuggestion(0)
    },
    [editingCell, functionNames]
  )

  useEffect(() => {
    computeFunctionSuggestions(editValue)
  }, [computeFunctionSuggestions, editValue])

  const applyFunctionSuggestion = useCallback((functionName: string) => {
    const input = inputRef.current
    if (!input) return

    const currentValue = input.value
    const caretStart = input.selectionStart ?? currentValue.length
    const caretEnd = input.selectionEnd ?? caretStart
    const textBeforeCaret = currentValue.slice(0, caretStart)
    const tokenMatch = textBeforeCaret.match(/([A-Za-z]+)$/)
    if (!tokenMatch) return

    const tokenLength = tokenMatch[1].length
    const tokenStart = caretStart - tokenLength
    const before = currentValue.slice(0, tokenStart)
    const after = currentValue.slice(caretEnd)
    const insertion = `${functionName}(`
    const nextValue = `${before}${insertion}${after}`

    setEditValue(nextValue)
    setFunctionSuggestions([])

    requestAnimationFrame(() => {
      const cursor = before.length + insertion.length
      inputRef.current?.setSelectionRange(cursor, cursor)
    })
  }, [])

  const finalizeReferenceSelection = useCallback(() => {
    if (!referenceSelectionActiveRef.current) {
      return
    }
    referenceSelectionActiveRef.current = false
    pendingReferenceRef.current = null
    setReferencePreview(null)
    window.removeEventListener("mouseup", finalizeReferenceSelection)
    const currentValue = inputRef.current?.value ?? ""
    computeFunctionSuggestions(currentValue)
    keyboardReferenceCursorRef.current = null
  }, [computeFunctionSuggestions])

  useEffect(() => {
    if (!editingCell) {
      finalizeReferenceSelection()
    }
  }, [editingCell, finalizeReferenceSelection])

  useEffect(() => {
    return () => {
      finalizeReferenceSelection()
    }
  }, [finalizeReferenceSelection])

  const startReferenceSelection = useCallback(
    (row: number, col: number, options: { bindMouseUp?: boolean } = { bindMouseUp: true }) => {
      const input = inputRef.current
      if (!input) return

      if (referenceSelectionActiveRef.current) {
        finalizeReferenceSelection()
      }

      const currentValue = input.value
      const selectionStart = input.selectionStart ?? currentValue.length
      const selectionEnd = input.selectionEnd ?? selectionStart
      const address = getCellAddress(row, col)
      const before = currentValue.slice(0, selectionStart)
      const after = currentValue.slice(selectionEnd)
      const nextValue = `${before}${address}${after}`
      const insertionStart = before.length
      const insertionEnd = insertionStart + address.length

      pendingReferenceRef.current = {
        startIndex: insertionStart,
        endIndex: insertionEnd,
        anchor: { row, col },
      }
      referenceSelectionActiveRef.current = true
      setReferencePreview({
        start: { row, col },
        end: { row, col },
      })
      setEditValue(nextValue)
      computeFunctionSuggestions(nextValue)
      keyboardReferenceCursorRef.current = { row, col }
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(insertionEnd, insertionEnd)
      })
      if (options.bindMouseUp) {
        window.addEventListener("mouseup", finalizeReferenceSelection)
      }
    },
    [computeFunctionSuggestions, finalizeReferenceSelection]
  )

  const updateReferenceSelection = useCallback(
    (row: number, col: number) => {
      if (!referenceSelectionActiveRef.current) {
        return
      }
      const pending = pendingReferenceRef.current
      if (!pending) return

      const anchor = pending.anchor
      const startRow = Math.min(anchor.row, row)
      const endRow = Math.max(anchor.row, row)
      const startCol = Math.min(anchor.col, col)
      const endCol = Math.max(anchor.col, col)

      const startAddress = getCellAddress(startRow, startCol)
      const endAddress = getCellAddress(endRow, endCol)
      const referenceString =
        startRow === endRow && startCol === endCol ? getCellAddress(anchor.row, anchor.col) : `${startAddress}:${endAddress}`

      setReferencePreview({
        start: { row: startRow, col: startCol },
        end: { row: endRow, col: endCol },
      })

      setEditValue((prev) => {
        const currentPending = pendingReferenceRef.current
        if (!currentPending) return prev

        const before = prev.slice(0, currentPending.startIndex)
        const after = prev.slice(currentPending.endIndex)
        const next = `${before}${referenceString}${after}`

        if (next === prev) {
          return prev
        }

        currentPending.endIndex = currentPending.startIndex + referenceString.length
        return next
      })

      requestAnimationFrame(() => {
        const currentPending = pendingReferenceRef.current
        if (currentPending) {
          inputRef.current?.setSelectionRange(currentPending.endIndex, currentPending.endIndex)
        }
      })
      keyboardReferenceCursorRef.current = { row, col }
    },
    []
  )

  const queueSuggestionRefresh = useCallback(() => {
    requestAnimationFrame(() => {
      const currentValue = inputRef.current?.value ?? ""
      computeFunctionSuggestions(currentValue)
    })
  }, [computeFunctionSuggestions])

  const toggleReferenceAnchors = useCallback(() => {
    const input = inputRef.current
    if (!input) return
    const selectionStart = input.selectionStart ?? 0
    const selectionEnd = input.selectionEnd ?? selectionStart
    const result = cycleReferenceInFormula(input.value, selectionStart, selectionEnd)
    if (!result) return
    setEditValue(result.value)
    computeFunctionSuggestions(result.value)
    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }, [computeFunctionSuggestions])

  const handleCellDoubleClick = (row: number, col: number) => {
    const cell = gridData[row]?.[col]
    const value = cell?.raw || ""
    setEditingCell({ row, col })
    setEditValue(value)
  }

  const handleCellMouseDown = (event: ReactMouseEvent<HTMLDivElement>, row: number, col: number) => {
    if (editingCell) {
      const currentValue = inputRef.current?.value ?? editValue
      const isFormulaEdit = currentValue.startsWith("=")
      const isSameCell = editingCell.row === row && editingCell.col === col

      if (isFormulaEdit) {
        event.preventDefault()
        event.stopPropagation()
        if (!isSameCell) {
          startReferenceSelection(row, col)
        } else {
          inputRef.current?.focus()
        }
        return
      }
    }

    if (event.button !== 0) return

    finalizeReferenceSelection()

    suppressSelectionSyncRef.current = true

    if (event.metaKey || event.ctrlKey) {
      addCellToSelection(row, col)
    } else if (event.shiftKey) {
      extendSelectionTo(row, col)
    } else {
      selectSingleCell(row, col)
      selectionDraggingRef.current = true
      window.addEventListener("mouseup", stopSelectionDragging)
    }

    onCellClick({ row, col })
  }

  const handleCellMouseEnter = (event: ReactMouseEvent<HTMLDivElement>, row: number, col: number) => {
    if (selectionDraggingRef.current && !editingCell) {
      suppressSelectionSyncRef.current = true
      extendSelectionTo(row, col)
      return
    }

    if (!referenceSelectionActiveRef.current) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    updateReferenceSelection(row, col)
  }

  const handleCellKeyDown = (e: KeyboardEvent, row: number, col: number) => {
    if (!editingCell && (e.metaKey || e.ctrlKey)) {
      const key = e.key.toLowerCase()
      if (key === "c") {
        e.preventDefault()
        void copySelection()
        return
      }
      if (key === "v") {
        e.preventDefault()
        void pasteFromClipboard()
        return
      }
      if (key === "x") {
        e.preventDefault()
        void cutSelection()
        return
      }
      if (key === "a") {
        e.preventDefault()
        suppressSelectionSyncRef.current = true
        const fullRange = normalizeRange({ row: 0, col: 0 }, { row: NUM_ROWS - 1, col: columns.length - 1 })
        applySelection([fullRange], { row: 0, col: 0 })
        onCellClick({ row: 0, col: 0 })
        return
      }
    }

    // Enter or F2 to start editing
    if (e.key === " " && !editingCell) {
      if (e.shiftKey) {
        e.preventDefault()
        suppressSelectionSyncRef.current = true
        applySelection([
          normalizeRange({ row, col: 0 }, { row, col: columns.length - 1 }),
        ], { row, col })
        onCellClick({ row, col })
        return
      }
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        suppressSelectionSyncRef.current = true
        applySelection([
          normalizeRange({ row: 0, col }, { row: NUM_ROWS - 1, col }),
        ], { row, col })
        onCellClick({ row, col })
        return
      }
    }

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
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault()
          const delta: Record<string, { dRow: number; dCol: number }> = {
            ArrowUp: { dRow: -1, dCol: 0 },
            ArrowDown: { dRow: 1, dCol: 0 },
            ArrowLeft: { dRow: 0, dCol: -1 },
            ArrowRight: { dRow: 0, dCol: 1 },
          }
          const { dRow, dCol } = delta[e.key]
          const currentEnvelope = getSelectionEnvelope()
          const anchor = selectionAnchorRef.current
          const baseRow = e.shiftKey && currentEnvelope ? currentEnvelope.end.row : anchor.row
          const baseCol = e.shiftKey && currentEnvelope ? currentEnvelope.end.col : anchor.col
          const targetRow = clamp(baseRow + dRow, 0, NUM_ROWS - 1)
          const targetCol = clamp(baseCol + dCol, 0, columns.length - 1)

          suppressSelectionSyncRef.current = true
          if (e.shiftKey) {
            extendSelectionTo(targetRow, targetCol)
          } else {
            selectSingleCell(targetRow, targetCol)
            selectionAnchorRef.current = { row: targetRow, col: targetCol }
          }
          onCellClick({ row: targetRow, col: targetCol })
          break
        }
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
    if (functionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedSuggestion((prev) => (prev + 1) % functionSuggestions.length)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedSuggestion((prev) =>
          (prev - 1 + functionSuggestions.length) % functionSuggestions.length
        )
        return
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault()
        const suggestion = functionSuggestions[highlightedSuggestion]
        if (suggestion) {
          applyFunctionSuggestion(suggestion)
        }
        return
      }
    }

    const arrowDeltas: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }

    const isArrow = arrowDeltas[e.key as keyof typeof arrowDeltas]

    if (editValue.startsWith("=") && isArrow) {
      e.preventDefault()
      const [dRow, dCol] = arrowDeltas[e.key as keyof typeof arrowDeltas]

      const anchor = pendingReferenceRef.current?.anchor
      const currentCursor = keyboardReferenceCursorRef.current

      if (!referenceSelectionActiveRef.current || !anchor || !currentCursor) {
        const anchorRow = activeCell.row
        const anchorCol = activeCell.col
        const nextRow = clamp(anchorRow + dRow, 0, NUM_ROWS - 1)
        const nextCol = clamp(anchorCol + dCol, 0, columns.length - 1)

        if (e.shiftKey) {
          startReferenceSelection(anchorRow, anchorCol, { bindMouseUp: false })
          updateReferenceSelection(nextRow, nextCol)
        } else {
          startReferenceSelection(nextRow, nextCol, { bindMouseUp: false })
        }
        return
      }

      const targetRow = clamp(currentCursor.row + dRow, 0, NUM_ROWS - 1)
      const targetCol = clamp(currentCursor.col + dCol, 0, columns.length - 1)

      if (e.shiftKey) {
        updateReferenceSelection(targetRow, targetCol)
      } else {
        startReferenceSelection(targetRow, targetCol, { bindMouseUp: false })
      }
      return
    }

    if (e.key === "F4") {
      e.preventDefault()
      toggleReferenceAnchors()
      return
    }

    if (e.key === "Escape" && functionSuggestions.length > 0) {
      e.preventDefault()
      setFunctionSuggestions([])
      return
    }

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

    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      queueSuggestionRefresh()
    }
  }

  const commitEdit = useCallback(() => {
    finalizeReferenceSelection()
    setFunctionSuggestions([])
    if (editingCell) {
      updateCellValue(editingCell.row, editingCell.col, editValue)
      setEditingCell(null)
    }
  }, [editingCell, editValue, finalizeReferenceSelection, updateCellValue])

  const cancelEdit = useCallback(() => {
    finalizeReferenceSelection()
    setFunctionSuggestions([])
    setEditingCell(null)
    setEditValue("")
  }, [finalizeReferenceSelection])

  useImperativeHandle(
    ref,
    () => ({
      setFormulaDraft: (value: string) => {
        const target = { row: activeCell.row, col: activeCell.col }
        setEditingCell((prev) => {
          if (!prev || prev.row !== target.row || prev.col !== target.col) {
            return target
          }
          return prev
        })
        setEditValue(value)
        setFunctionSuggestions([])
        computeFunctionSuggestions(value)
        finalizeReferenceSelection()
        requestAnimationFrame(() => {
          inputRef.current?.focus()
          const cursor = value.length
          inputRef.current?.setSelectionRange(cursor, cursor)
        })
      },
      commitFormulaDraft: (value: string) => {
        setFunctionSuggestions([])
        finalizeReferenceSelection()
        setEditValue(value)
        updateCellValue(activeCell.row, activeCell.col, value)
        setEditingCell(null)
      },
      cancelFormulaDraft: () => {
        cancelEdit()
      },
      toggleReferenceAnchor: () => {
        toggleReferenceAnchors()
      },
    }),
    [
      activeCell.col,
      activeCell.row,
      cancelEdit,
      computeFunctionSuggestions,
      finalizeReferenceSelection,
      toggleReferenceAnchors,
      updateCellValue,
    ]
  )

  const handleInputBlur = () => {
    commitEdit()
  }

  return (
    <div className="relative">
      {/* Column Headers */}
      <div className="sticky top-0 z-20 flex border-b border-border bg-muted">
        <div className="flex h-8 w-12 shrink-0 items-center justify-center border-r border-border bg-muted" />
        {columns.map((col, idx) => {
          const isColumnSelected = selectedRanges.some((range) => idx >= range.start.col && idx <= range.end.col)
          return (
            <div
              key={col}
              className={cn(
                "relative flex h-8 shrink-0 items-center justify-center border-r border-border bg-muted font-mono text-xs font-medium",
                isColumnSelected ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )}
              style={{ width: columnWidths[idx] }}
            >
              {col}
              <div
                onMouseDown={(event) => startColumnResize(event, idx)}
                className="absolute right-0 top-0 h-full w-2 -translate-x-1/2 cursor-col-resize bg-transparent"
              />
            </div>
          )
        })}
      </div>

      {/* Grid Rows */}
      <div className="relative">
        {Array.from({ length: NUM_ROWS }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="flex border-b border-border"
            style={{ height: rowHeights[rowIdx] }}
          >
            {/* Row Number */}
            <div
              className={cn(
                "relative flex w-12 shrink-0 items-center justify-center border-r border-border bg-muted font-mono text-xs font-medium",
                selectedRanges.some((range) => rowIdx >= range.start.row && rowIdx <= range.end.row)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground"
              )}
            >
              {rowIdx + 1}
              <div
                onMouseDown={(event) => startRowResize(event, rowIdx)}
                className="absolute bottom-0 left-0 h-2 w-full cursor-row-resize bg-transparent"
              />
            </div>

            {/* Row Cells */}
            {columns.map((_, colIdx) => {
              const rawValue = gridData[rowIdx]?.[colIdx]?.raw ?? ""
              const isFormula = rawValue.startsWith("=")
              const engineValue = isFormula ? getEngineValue(rowIdx, colIdx) : null
              const displayValue = isFormula ? formatComputedValue(rowIdx, engineValue) : rawValue
              const isActive = activeCell.row === rowIdx && activeCell.col === colIdx
              const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx
              const isHeader = colIdx === 0 && rawValue !== ""
              const numericFromFormula = typeof engineValue === "number"
              const isNumeric =
                (!isFormula && rawValue !== "" && /^[\d,]+$/.test(rawValue.replace(/[%$]/g, ""))) ||
                numericFromFormula
              const rowHeader = gridData[rowIdx]?.[0]?.raw ?? ""
              const isPercentage = rowHeader.includes("%") || rawValue.includes("%")
              const allHighlights = previewHighlight
                ? [...referenceHighlights, previewHighlight]
                : referenceHighlights
              const activeHighlight = allHighlights.find(
                (range) =>
                  rowIdx >= range.start.row &&
                  rowIdx <= range.end.row &&
                  colIdx >= range.start.col &&
                  colIdx <= range.end.col
              )
              const isSelected = selectedRanges.some((range) => isCellInRange(range, rowIdx, colIdx))
              const highlightStyle = activeHighlight
                ? {
                    boxShadow: `inset 0 0 0 2px ${activeHighlight.color}`,
                    backgroundColor: `${activeHighlight.color}1A`,
                  }
                : undefined

              return (
                <div
                  key={colIdx}
                  ref={(el) => {
                    if (!cellRefs.current[rowIdx]) {
                      cellRefs.current[rowIdx] = []
                    }
                    cellRefs.current[rowIdx][colIdx] = el
                  }}
                  onMouseDown={(event) => handleCellMouseDown(event, rowIdx, colIdx)}
                  onMouseEnter={(event) => handleCellMouseEnter(event, rowIdx, colIdx)}
                  onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                  onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                  onCopy={handleCopyEvent}
                  onCut={handleCutEvent}
                  onPaste={handlePasteEvent}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    "relative flex h-full shrink-0 cursor-cell items-center border-r border-border px-2 text-sm transition-colors",
                    isActive && "ring-2 ring-primary ring-inset z-10",
                    isHeader && "bg-muted font-medium text-foreground",
                    !isHeader && "bg-card text-foreground hover:bg-accent",
                    isNumeric && !isEditing && "justify-end font-mono",
                    isPercentage && "text-success",
                    isFormula && "text-primary font-mono",
                    isSelected && !isActive && !activeHighlight && "bg-primary/5",
                  )}
                  style={{ width: columnWidths[colIdx], ...highlightStyle }}
                >
                  {isEditing ? (
                    <>
                      <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => {
                          const next = e.target.value
                          setEditValue(next)
                          computeFunctionSuggestions(next)
                        }}
                        onKeyDown={handleInputKeyDown}
                        onBlur={handleInputBlur}
                        className={cn(
                          "absolute inset-0 h-full w-full border-2 border-primary bg-card px-2 text-sm outline-none",
                          isNumeric && "text-right font-mono",
                        )}
                      />
                      {functionSuggestions.length > 0 && (
                        <div className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-md border border-border bg-card shadow-md">
                          {functionSuggestions.map((fnName, idx) => (
                            <button
                              key={fnName}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                applyFunctionSuggestion(fnName)
                              }}
                              onMouseEnter={() => setHighlightedSuggestion(idx)}
                              className={cn(
                                "flex w-full items-center px-2 py-1 font-mono text-xs text-foreground",
                                idx === highlightedSuggestion
                                  ? "bg-primary/10 text-primary"
                                  : "hover:bg-muted"
                              )}
                            >
                              {fnName}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="truncate">{displayValue}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
})
