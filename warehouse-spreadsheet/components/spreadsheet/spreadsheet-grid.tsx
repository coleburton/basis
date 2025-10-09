"use client"

import {
  useState,
  useEffect,
  useRef,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ClipboardEvent as ReactClipboardEvent,
  FocusEvent as ReactFocusEvent,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  type CSSProperties,
} from "react"
import { HyperFormula, DetailedCellError, type CellValue, type SimpleCellAddress } from "hyperformula"
import { parseFormula } from "@/lib/formula/parser"
import { cn } from "@/lib/utils"
import { type DetectedDateRange } from "@/lib/date-detection"
import {
  isMetricFormula,
  evaluateMetricFormula,
  type MetricEvaluationResult
} from "@/lib/formula/metric-evaluator"
import { 
  useWorkbook,
  type MetricRangeConfig,
  type MetricRangeRowConfig,
  type MetricCellResult,
  type CellFormat,
  type CellContent,
} from "@/lib/workbook/workbook-context"

interface SpreadsheetGridProps {
  activeCell: { row: number; col: number }
  onCellClick: (cell: { row: number; col: number }) => void
  onCellChange?: (row: number, col: number, value: string) => void
  onFormulaChange?: (formula: string) => void
  onEditingStateChange?: (state: { isEditing: boolean; isFormula: boolean; sheetId: string | null }) => void
  detectedRanges?: DetectedDateRange[]
  onEditMetricRange?: (config: MetricRangeConfig) => void
}

// Re-export types for backwards compatibility
export type { MetricRangeRowConfig, MetricRangeConfig }

export interface SpreadsheetGridHandle {
  setFormulaDraft: (value: string, options?: { focusCell?: boolean; source?: 'grid' | 'formulaBar' }) => void
  commitFormulaDraft: (value: string) => void
  cancelFormulaDraft: () => void
  toggleReferenceAnchor: () => void
  preserveEditOnNextBlur: () => void
  getEditingContext: () => { isEditing: boolean; sheetId: string | null; isFormula: boolean }
  applyFormatting: (format: Partial<CellFormat>) => void
  getSelectionFormat: () => CellFormat | null
  getGridData: () => CellContent[][]
  setCellValue: (row: number, col: number, value: string, options?: { skipUndo?: boolean; metricRangeId?: string | null }) => void
  applyMetricRange: (config: MetricRangeConfig) => void
  getMetricRange: (id: string) => MetricRangeConfig | null
  getMetricRanges: () => Record<string, MetricRangeConfig>
  getMetricCells: () => Record<string, { value: number | string | null; loading: boolean; error: string | null }>
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
  sheetName?: string | null
}

interface CellRange {
  start: { row: number; col: number }
  end: { row: number; col: number }
}

const DEFAULT_COLUMN_WIDTH = 128
const DEFAULT_ROW_HEIGHT = 40
const MIN_COLUMN_WIDTH = 60
const MIN_ROW_HEIGHT = 24

const SHEET_NAME_PATTERN = `(?:'[^']+'|[A-Za-z0-9_]+)`
const CELL_TOKEN_PATTERN = `\\$?[A-Z]+\\$?\\d+(?::\\$?[A-Z]+\\$?\\d+)?`
const FULL_REFERENCE_PATTERN = new RegExp(`(?:${SHEET_NAME_PATTERN}!){0,1}${CELL_TOKEN_PATTERN}`, "gi")

const splitReferenceToken = (token: string) => {
  if (!token.includes("!")) {
    return { sheetToken: null as string | null, cellToken: token }
  }
  const [rawSheet, cellToken] = token.split("!")
  return { sheetToken: rawSheet ?? null, cellToken }
}

const normalizeSheetToken = (sheetToken: string | null) => {
  if (!sheetToken) return null
  if (sheetToken.startsWith("'") && sheetToken.endsWith("'")) {
    const inner = sheetToken.slice(1, -1)
    return inner.replace(/''/g, "'")
  }
  return sheetToken
}

const needsSheetQuotes = (name: string) => /[\s'!]/.test(name)

const formatSheetPrefix = (name: string | null | undefined) => {
  if (!name) return ""
  const escaped = name.replace(/'/g, "''")
  return needsSheetQuotes(name) ? `'${escaped}'!` : `${name}!`
}

const extractFormulaHighlights = (formula: string, visibleSheetName: string | null): ReferenceHighlight[] => {
  if (!formula.startsWith("=")) return []
  const matches = formula.match(FULL_REFERENCE_PATTERN) || []
  const highlights: ReferenceHighlight[] = []

  matches.forEach((token, idx) => {
    const { sheetToken, cellToken } = splitReferenceToken(token)
    const normalizedSheet = normalizeSheetToken(sheetToken)
    if (normalizedSheet && visibleSheetName && normalizedSheet !== visibleSheetName) {
      return
    }
    const [startRef, endRef] = cellToken.split(":")
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
      sheetName: normalizedSheet,
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
  const pattern = FULL_REFERENCE_PATTERN
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

    const token = match[0]
    const { sheetToken, cellToken } = splitReferenceToken(token)
    const cycledCell = cycleReferenceToken(cellToken)
    const cycled = cycledCell ? `${sheetToken ? `${sheetToken}!` : ""}${cycledCell}` : null
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

  return formula.replace(FULL_REFERENCE_PATTERN, (token) => {
    const { sheetToken, cellToken } = splitReferenceToken(token)
    const [startRef, endRef] = cellToken.split(":")
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
      return sheetToken ? `${sheetToken}!${adjustedStart}` : adjustedStart
    }

    const parsedEnd = parseCellReference(endRef)
    if (!parsedEnd) return token

    const adjustedEnd = adjustCoordinate(
      parsedEnd.column,
      parsedEnd.row,
      parsedEnd.colAnchored,
      parsedEnd.rowAnchored,
    )

    const adjustedRange = `${adjustedStart}:${adjustedEnd}`
    return sheetToken ? `${sheetToken}!${adjustedRange}` : adjustedRange
  })
}

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 24 * 60 * 60 * 1000

const toExcelSerial = (date: Date): number => {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  return Math.round((utc - EXCEL_EPOCH_MS) / MS_PER_DAY)
}

const serialToDate = (serial: number): Date => {
  return new Date(EXCEL_EPOCH_MS + serial * MS_PER_DAY)
}

const parseDateStringToSerial = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null

  // Don't parse numeric values (including decimals) as dates
  // This prevents values like .38, 0.5, 123.45 from being treated as dates
  if (/^-?\d*\.?\d+$/.test(trimmed)) {
    return null
  }

  // Only parse as serial number if it's a large integer (likely a date serial)
  // Excel date serials are typically > 1000 (dates after ~1902)
  if (/^\d{5,}$/.test(trimmed)) {
    const serial = Number(trimmed)
    if (!Number.isNaN(serial) && serial >= 1000) {
      return serial
    }
  }

  // ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (!Number.isNaN(date.getTime())) {
      return toExcelSerial(date)
    }
  }

  // Slash format: MM/DD/YYYY or MM-DD-YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    const numericYear = Number(year.length === 2 ? `20${year}` : year)
    const date = new Date(Date.UTC(numericYear, Number(month) - 1, Number(day)))
    if (!Number.isNaN(date.getTime())) {
      return toExcelSerial(date)
    }
  }

  // REMOVED: Aggressive fallback new Date() parsing
  // This was causing decimal numbers and other non-date strings to be parsed as dates

  return null
}

const normalizeValueForEngine = (value: string, format?: CellFormat): string | number | null => {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith("=")) return trimmed

  const serial = parseDateStringToSerial(trimmed)
  if (serial !== null) {
    return serial
  }

  if (trimmed.endsWith("%")) {
    const numeric = Number(trimmed.slice(0, -1).replace(/[$,]/g, ""))
    return Number.isNaN(numeric) ? value : numeric / 100
  }

  const sanitized = trimmed.replace(/[$,]/g, "")
  const numeric = Number(sanitized)
  return Number.isNaN(numeric) ? value : numeric
}

const autoCloseFormula = (value: string): string => {
  if (!value) return value

  const trailingWhitespaceMatch = value.match(/\s*$/)
  const trailingWhitespace = trailingWhitespaceMatch ? trailingWhitespaceMatch[0] : ""
  const core = value.slice(0, value.length - trailingWhitespace.length)
  if (!core.trimStart().startsWith("=")) {
    return value
  }

  const stack: string[] = []
  const opening = new Set(["(", "[", "{"])
  const closingMap: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}"
  }
  const matchingOpen: Record<string, string> = {
    ")": "(",
    "]": "[",
    "}": "{"
  }

  let inString = false
  for (let i = 0; i < core.length; i++) {
    const ch = core[i]
    if (ch === '"') {
      const prev = core[i - 1]
      if (prev !== '\\') {
        inString = !inString
      }
      continue
    }
    if (inString) continue

    if (opening.has(ch)) {
      stack.push(ch)
    } else if (ch in matchingOpen) {
      if (stack.length && stack[stack.length - 1] === matchingOpen[ch]) {
        stack.pop()
      }
    }
  }

  if (stack.length === 0) {
    return value
  }

  let result = core
  while (stack.length) {
    const opener = stack.pop()!
    result += closingMap[opener] ?? ''
  }

  return result + trailingWhitespace
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

interface UndoAction {
  type: 'cell-change' | 'bulk-change'
  changes: Array<{
    row: number
    col: number
    oldValue: string
    newValue: string
    oldMetricRangeId?: string | null
    newMetricRangeId?: string | null
  }>
}

export const SpreadsheetGrid = forwardRef<SpreadsheetGridHandle, SpreadsheetGridProps>(function SpreadsheetGrid({
  activeCell,
  onCellClick,
  onCellChange,
  onFormulaChange,
  onEditingStateChange,
  detectedRanges = [],
  onEditMetricRange,
}: SpreadsheetGridProps, ref) {
  const initialGrid = useMemo(() => createInitialGridData(), [])

  // Use workbook context for multi-sheet support
  const { sheets, activeSheet, updateSheetData, updateSheetMetricRanges, updateSheetMetricCells, setActiveSheet, getSheet } = useWorkbook()
  const gridData = activeSheet?.gridData ?? initialGrid
  const metricRanges = activeSheet?.metricRanges ?? {}
  const sheetMetricCells = activeSheet?.metricCells ?? {}
  const latestGridDataRef = useRef<CellContent[][]>(gridData)
  const pendingSheetUpdatesRef = useRef<Map<string, CellContent[][]>>(new Map())
  const hyperFormulaSheetIdMapRef = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    latestGridDataRef.current = gridData
    if (activeSheet) {
      pendingSheetUpdatesRef.current.set(activeSheet.id, gridData)
    }
  }, [gridData])

  // Wrapper to sync grid data changes to workbook context while supporting batched updates
  const setGridData = useCallback((updater: CellContent[][] | ((prev: CellContent[][]) => CellContent[][])) => {
    if (!activeSheet) return
    const baseData = latestGridDataRef.current
    const newData = typeof updater === 'function' ? updater(baseData) : updater
    latestGridDataRef.current = newData
    updateSheetData(activeSheet.id, newData)
  }, [activeSheet, updateSheetData])

  const hyperFormulaRef = useRef<HyperFormula | null>(null)
  const sheetIdRef = useRef<number>(0)
  useEffect(() => {
    if (activeSheet) {
      const hfSheetId = hyperFormulaSheetIdMapRef.current.get(activeSheet.id)
      if (typeof hfSheetId === "number") {
        sheetIdRef.current = hfSheetId
      }
    }
  }, [activeSheet])
  const getHyperFormulaSheetId = useCallback((sheetId?: string | null) => {
    if (sheetId) {
      const mapped = hyperFormulaSheetIdMapRef.current.get(sheetId)
      if (typeof mapped === "number") {
        return mapped
      }
    }
    if (activeSheet) {
      const activeMapped = hyperFormulaSheetIdMapRef.current.get(activeSheet.id)
      if (typeof activeMapped === "number") {
        return activeMapped
      }
    }
    return sheetIdRef.current
  }, [activeSheet])
  const cellRefs = useRef<HTMLDivElement[][]>([])
  const [columnWidths, setColumnWidths] = useState<number[]>(() => Array(columns.length).fill(DEFAULT_COLUMN_WIDTH))
  const [rowHeights, setRowHeights] = useState<number[]>(() => Array(NUM_ROWS).fill(DEFAULT_ROW_HEIGHT))
  const [undoStack, setUndoStack] = useState<UndoAction[]>([])
  const [redoStack, setRedoStack] = useState<UndoAction[]>([])

  const [selectedRanges, setSelectedRanges] = useState<CellRange[]>(() => [
    { start: { row: activeCell.row, col: activeCell.col }, end: { row: activeCell.row, col: activeCell.col } },
  ])
  const selectionAnchorRef = useRef<{ row: number; col: number }>({ row: activeCell.row, col: activeCell.col })
  const suppressSelectionSyncRef = useRef(false)
  const selectionDraggingRef = useRef(false)

  // Memoize selected cell lookup for performance
  const selectedCellsSet = useMemo(() => {
    const set = new Set<string>()
    selectedRanges.forEach(range => {
      for (let row = range.start.row; row <= range.end.row; row++) {
        for (let col = range.start.col; col <= range.end.col; col++) {
          set.add(`${row},${col}`)
        }
      }
    })
    return set
  }, [selectedRanges])
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
    sheetId?: string | null
  } | null>(null)
  const pendingReferenceRef = useRef<{
    startIndex: number
    endIndex: number
    anchor: { row: number; col: number }
    sheetId: string | null
    sheetName: string | null
    includeSheetPrefix: boolean
  } | null>(null)
  const referenceSelectionActiveRef = useRef(false)
  const keyboardReferenceCursorRef = useRef<{ row: number; col: number; sheetId: string | null } | null>(null)
  const preserveEditOnBlurRef = useRef(false)
  const editingSheetIdRef = useRef<string | null>(null)

  // Metric cell evaluation state - synced with sheet
  const [metricCells, setMetricCells] = useState<Record<string, MetricEvaluationResult>>(() => sheetMetricCells)
  const metricEvaluationInProgressRef = useRef<Set<string>>(new Set())
  const [hoveredMetricRangeId, setHoveredMetricRangeId] = useState<string | null>(null)
  const lastSyncedMetricCellsRef = useRef<Record<string, MetricEvaluationResult>>(sheetMetricCells)
  
  // Load metricCells from sheet when switching sheets
  useEffect(() => {
    setMetricCells(sheetMetricCells)
    lastSyncedMetricCellsRef.current = sheetMetricCells
  }, [activeSheet?.id])

  // Sync metricCells to sheet when they actually change (debounced to avoid loops)
  useEffect(() => {
    if (!activeSheet) return
    
    // Only sync if metricCells actually changed (not just a re-render)
    const hasChanged = JSON.stringify(metricCells) !== JSON.stringify(lastSyncedMetricCellsRef.current)
    
    if (hasChanged) {
      const timeoutId = setTimeout(() => {
        updateSheetMetricCells(activeSheet.id, metricCells)
        lastSyncedMetricCellsRef.current = metricCells
      }, 100) // Small debounce to batch updates
      
      return () => clearTimeout(timeoutId)
    }
  }, [metricCells, activeSheet, updateSheetMetricCells])
  const editingSourceRef = useRef<'grid' | 'formulaBar' | null>(null)
  const previousEditingStateRef = useRef<{ isEditing: boolean; sheetId: string | null; isFormula: boolean }>({
    isEditing: false,
    sheetId: null,
    isFormula: false,
  })
  const updateEngineMetricValue = useCallback(
    (row: number, col: number, result: MetricEvaluationResult | { value: number | string | null; error: string | null }) => {
      const hf = hyperFormulaRef.current
      if (!hf) return

      const sheetId = getHyperFormulaSheetId(activeSheet?.id)
      const address: SimpleCellAddress = { sheet: sheetId, row, col }

      try {
        if ('error' in result && result.error) {
          hf.setCellContents(address, "#ERROR!")
          return
        }

        const value = result.value
        if (value === null || value === undefined) {
          hf.setCellContents(address, "")
        } else if (typeof value === "number") {
          hf.setCellContents(address, value)
        } else {
          hf.setCellContents(address, String(value))
        }
      } catch (error) {
        console.error(`Failed to sync metric value with engine at [${row}, ${col}]`, error)
      }
    },
    [activeSheet?.id, getHyperFormulaSheetId]
  )

  // Sync cached metric values to HyperFormula when sheet switches
  useEffect(() => {
    if (!activeSheet || !hyperFormulaRef.current) return

    // Sync all cached metric cell values to HyperFormula so formulas can reference them
    Object.entries(sheetMetricCells).forEach(([cellKey, result]) => {
      if (!result.error && result.value !== null) {
        const [rowStr, colStr] = cellKey.split(',')
        const row = parseInt(rowStr, 10)
        const col = parseInt(colStr, 10)
        if (!isNaN(row) && !isNaN(col)) {
          updateEngineMetricValue(row, col, result)
        }
      }
    })
  }, [activeSheet?.id, sheetMetricCells, updateEngineMetricValue])

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

  const dateFormatter = useMemo(() => {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone: "UTC",
    })
  }, [])

  const activeMetricRangeId = gridData[activeCell.row]?.[activeCell.col]?.metricRangeId ?? null

  const referenceHighlights = useMemo<ReferenceHighlight[]>(() => {
    if (!editingCell) return []
    const currentValue = editValue
    if (!currentValue.startsWith("=")) return []
    return extractFormulaHighlights(currentValue, activeSheet?.name ?? null)
  }, [activeSheet?.name, editValue, editingCell])

  const previewHighlight = useMemo<ReferenceHighlight | null>(() => {
    if (!referencePreview) return null
    if (referencePreview.sheetId && activeSheet && referencePreview.sheetId !== activeSheet.id) {
      return null
    }
    const color = REFERENCE_COLORS[referenceHighlights.length % REFERENCE_COLORS.length]
    return {
      start: referencePreview.start,
      end: referencePreview.end,
      color,
    }
  }, [activeSheet, referenceHighlights.length, referencePreview])

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

  // Initialize HyperFormula when workbook sheets change
  useEffect(() => {
    if (!activeSheet || sheets.length === 0) return

    const sheetsPayload: Record<string, (string | number | null)[][]> = {}
    sheets.forEach(sheet => {
      sheetsPayload[sheet.name] = sheet.gridData.map(row =>
        row.map(cell => normalizeValueForEngine(cell.raw, cell.format))
      )
    })

    if (hyperFormulaRef.current) {
      hyperFormulaRef.current.destroy()
    }

    const hf = HyperFormula.buildFromSheets(sheetsPayload, { licenseKey: "gpl-v3" })
    hyperFormulaRef.current = hf

    const sheetIdMap = new Map<string, number>()
    sheets.forEach(sheet => {
      const hfSheetId = hf.getSheetId(sheet.name)
      if (typeof hfSheetId === "number") {
        sheetIdMap.set(sheet.id, hfSheetId)
      }
    })
    hyperFormulaSheetIdMapRef.current = sheetIdMap
    const activeHfSheetId = sheetIdMap.get(activeSheet.id) ?? 0
    sheetIdRef.current = activeHfSheetId

    const availableFunctions = hf.getRegisteredFunctionNames().sort()
    setFunctionNames(availableFunctions)

    return () => {
      hf.destroy()
      hyperFormulaRef.current = null
    }
  }, [activeSheet, sheets])

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

  // Focus input when editing starts - optimized with requestIdleCallback
  useEffect(() => {
    if (editingCell && inputRef.current) {
      if (editingSourceRef.current !== 'formulaBar') {
        inputRef.current.focus()
        inputRef.current.select()
      }
    } else {
      // Use requestIdleCallback for non-critical focus operations
      const idleCallback = window.requestIdleCallback ? window.requestIdleCallback(() => {
        const target = cellRefs.current[activeCell.row]?.[activeCell.col]
        target?.focus()
      }) : requestAnimationFrame(() => {
        const target = cellRefs.current[activeCell.row]?.[activeCell.col]
        target?.focus()
      })
      return () => {
        if (window.requestIdleCallback) {
          window.cancelIdleCallback(idleCallback as number)
        }
      }
    }
  }, [activeCell, editingCell])

  // Update formula bar when active cell changes - consolidated
  useEffect(() => {
    if (!onFormulaChange) return

    if (
      editingCell &&
      editingCell.row === activeCell.row &&
      editingCell.col === activeCell.col
    ) {
      onFormulaChange(editValue)
    } else {
      const cell = gridData[activeCell.row]?.[activeCell.col]
      const cellValue = cell?.raw || ""
      onFormulaChange(cellValue)
    }
  }, [activeCell, gridData, onFormulaChange, editingCell, editValue])

  const getEngineValue = useCallback(
    (row: number, col: number): CellValue | null => {
      const hf = hyperFormulaRef.current
      if (!hf) return null

      const sheetId = getHyperFormulaSheetId(activeSheet?.id)
      const address: SimpleCellAddress = { sheet: sheetId, row, col }
      try {
        return hf.getCellValue(address)
      } catch (error) {
        console.error(`HyperFormula getCellValue failed at [${row}, ${col}]:`, error)
        return null
      }
    },
    [activeSheet?.id, getHyperFormulaSheetId]
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

  const formatDateValue = useCallback((value: string | number): string | null => {
    if (value === null || value === undefined || value === "") return null
    let serial: number | null = null
    if (typeof value === "number" && Number.isFinite(value)) {
      serial = value
    } else if (typeof value === "string") {
      serial = parseDateStringToSerial(value)
    }
    if (serial === null) {
      return null
    }
    return dateFormatter.format(serialToDate(serial))
  }, [dateFormatter])

  const getCellDisplayValue = useCallback(
    (row: number, col: number): string => {
      const rawValue = gridData[row]?.[col]?.raw ?? ""
      if (rawValue.startsWith("=")) {
        // Check if this is a METRIC formula
        if (isMetricFormula(rawValue)) {
          const cellKey = `${row},${col}`
          const metricResult = metricCells[cellKey]

          if (metricResult) {
            if (metricResult.loading) {
              return "Loading..."
            }
            if (metricResult.error) {
              return "#ERROR!"
            }
            if (metricResult.value !== null && metricResult.value !== undefined) {
              // Format the metric value
              if (typeof metricResult.value === 'number') {
                return numberFormatter.format(metricResult.value)
              }
              return String(metricResult.value)
            }
          }
          return "..."
        }

        // Regular formula - use HyperFormula
        const engineValue = getEngineValue(row, col)
        return engineValue === null ? "" : formatComputedValue(row, engineValue)
      }
      return rawValue
    },
    [formatComputedValue, getEngineValue, gridData, metricCells, numberFormatter]
  )

  // Evaluate metric formulas asynchronously
  const evaluateMetricCell = useCallback(async (row: number, col: number, formula: string) => {
    const cellKey = `${row},${col}`

    // Check if already evaluating
    if (metricEvaluationInProgressRef.current.has(cellKey)) {
      return
    }

    // Mark as in progress
    metricEvaluationInProgressRef.current.add(cellKey)

    // Set loading state (preserve previous value in engine during loading)
    setMetricCells(prev => ({
      ...prev,
      [cellKey]: { value: prev[cellKey]?.value ?? null, loading: true, error: null }
    }))

    try {
      // Evaluate the metric formula
      const result = await evaluateMetricFormula(formula, row, col, detectedRanges)

      // Update with result
      setMetricCells(prev => ({
        ...prev,
        [cellKey]: result
      }))
      // Only update engine with successful results
      if (!result.error) {
        updateEngineMetricValue(row, col, result)
      }
    } catch (error) {
      console.error(`Error evaluating metric at [${row}, ${col}]:`, error)
      setMetricCells(prev => ({
        ...prev,
        [cellKey]: {
          value: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
      // Don't update engine with error - preserve previous value
    } finally {
      // Remove from in-progress set
      metricEvaluationInProgressRef.current.delete(cellKey)
    }
  }, [detectedRanges, updateEngineMetricValue])

  // Cleanup orphaned metric ranges (ranges with no cells referencing them)
  const cleanupOrphanedMetricRanges = useCallback(() => {
    if (!activeSheet) return
    
    const currentGrid = latestGridDataRef.current ?? []
    const prev = metricRanges
    const referencedRangeIds = new Set<string>()

    for (const row of currentGrid) {
      for (const cell of row) {
        if (cell?.metricRangeId) {
          referencedRangeIds.add(cell.metricRangeId)
        }
      }
    }

    const cleanedRanges: Record<string, MetricRangeConfig> = {}
    let hasChanges = false
    for (const [id, config] of Object.entries(prev)) {
      if (referencedRangeIds.has(id)) {
        cleanedRanges[id] = config
      } else {
        hasChanges = true
      }
    }

    if (hasChanges) {
      updateSheetMetricRanges(activeSheet.id, cleanedRanges)
    }
  }, [activeSheet, metricRanges, updateSheetMetricRanges])

  const updateCellValue = useCallback((
    row: number,
    col: number,
    value: string,
    options: { skipUndo?: boolean; metricRangeId?: string | null } = {},
    overrides: { sheetId?: string | null } = {}
  ) => {
    const { skipUndo = false, metricRangeId } = options
    const autoValue = autoCloseFormula(value)
    const trimmedAutoValue = autoValue.trim()
    const targetSheetId = overrides.sheetId ?? editingSheetIdRef.current ?? activeSheet?.id ?? null
    if (!targetSheetId) return

    const targetSheet = targetSheetId === activeSheet?.id
      ? activeSheet
      : getSheet(targetSheetId)
    if (!targetSheet) return

    const hf = hyperFormulaRef.current
    const hfSheetId = getHyperFormulaSheetId(targetSheetId)
    const address: SimpleCellAddress = { sheet: hfSheetId, row, col }

    const currentGrid =
      targetSheetId === activeSheet?.id
        ? latestGridDataRef.current ?? targetSheet.gridData
        : pendingSheetUpdatesRef.current.get(targetSheetId) ?? targetSheet.gridData
    const baseGrid = currentGrid ?? []
    const newData = baseGrid.map(rowArr =>
      rowArr ? rowArr.map(cell => ({ ...cell })) : Array.from({ length: columns.length }, () => ({ raw: "" }))
    )

    if (!newData[row]) {
      newData[row] = Array.from({ length: columns.length }, () => ({ raw: "" }))
    }

    const currentCell = newData[row]?.[col]
    const currentFormat = currentCell?.format
    const normalized = normalizeValueForEngine(autoValue, currentFormat)
    let cleanupNeeded = false

    if (process.env.NODE_ENV !== "production") {
      console.debug("[grid] updateCellValue", { row, col, value: autoValue, metricRangeId, targetSheetId })
    }

    if (hf) {
      try {
        hf.setCellContents(address, normalized)
      } catch (error) {
        console.error(`HyperFormula setCellContents failed at [${row}, ${col}]:`, error)
      }
    }

    const prevCell = currentCell
    const oldValue = prevCell?.raw ?? ""
    const oldMetricRangeId = prevCell?.metricRangeId ?? null
    let nextMetricRangeId: string | null | undefined

    if (metricRangeId !== undefined) {
      nextMetricRangeId = metricRangeId
    } else if (trimmedAutoValue === "") {
      nextMetricRangeId = null
    } else {
      nextMetricRangeId = oldMetricRangeId
    }

    if (!skipUndo && oldValue !== autoValue) {
      setUndoStack(prev => [...prev, {
        type: 'cell-change',
        changes: [{
          row,
          col,
          oldValue,
          newValue: autoValue,
          oldMetricRangeId,
          newMetricRangeId: nextMetricRangeId ?? null,
        }]
      }])
      setRedoStack([])
    }

    const existingCell = newData[row][col] || { raw: "" }
    const nextCell: CellContent = {
      ...existingCell,
      raw: autoValue,
    }

    if (nextMetricRangeId === null) {
      delete nextCell.metricRangeId
    } else if (nextMetricRangeId !== undefined) {
      nextCell.metricRangeId = nextMetricRangeId
    }

    newData[row][col] = nextCell

    if (oldMetricRangeId && oldMetricRangeId !== (nextMetricRangeId ?? null)) {
      cleanupNeeded = true
    }

    pendingSheetUpdatesRef.current.set(targetSheetId, newData)
    if (targetSheetId === activeSheet?.id) {
      latestGridDataRef.current = newData
    }

    updateSheetData(targetSheetId, newData)

    if (cleanupNeeded) {
      setTimeout(() => {
        cleanupOrphanedMetricRanges()
      }, 0)
    }

    // If the cell contains a METRIC formula, evaluate it
    if (isMetricFormula(autoValue) && targetSheetId === activeSheet?.id) {
      void evaluateMetricCell(row, col, autoValue)
    }

    if (onCellChange && targetSheetId === activeSheet?.id) {
      onCellChange(row, col, autoValue)
    }
    if (
      onFormulaChange &&
      targetSheetId === (editingSheetIdRef.current ?? activeSheet?.id) &&
      row === activeCell.row &&
      col === activeCell.col
    ) {
      onFormulaChange(autoValue)
    }
  }, [
    activeCell.col,
    activeCell.row,
    activeSheet,
    cleanupOrphanedMetricRanges,
    evaluateMetricCell,
    onCellChange,
    onFormulaChange,
    getSheet,
    updateSheetData,
    getHyperFormulaSheetId,
  ])

  const applyMetricRange = useCallback((config: MetricRangeConfig) => {
    const uniqueSortedColumns = Array.from(new Set(config.columns)).sort((a, b) => a - b)
    const normalizedRows = config.rows
      .map(rowConfig => ({
        ...rowConfig,
      }))
      .sort((a, b) => a.row - b.row)

    const normalizedConfig: MetricRangeConfig = {
      ...config,
      columns: uniqueSortedColumns,
      rows: normalizedRows,
    }

    if (process.env.NODE_ENV !== "production") {
      console.debug("[grid] applyMetricRange", {
        id: normalizedConfig.id,
        columns: uniqueSortedColumns,
        rows: normalizedRows.map(r => ({ ...r })),
      })
    }

    const previousConfig = metricRanges[normalizedConfig.id]
    if (previousConfig) {
      previousConfig.rows.forEach(rowConfig => {
        if (rowConfig.label !== undefined) {
          updateCellValue(rowConfig.row, 0, "", { skipUndo: true, metricRangeId: null })
        }
        previousConfig.columns.forEach(col => {
          updateCellValue(rowConfig.row, col, "", { skipUndo: true, metricRangeId: null })
        })
      })
    }

    normalizedRows.forEach(rowConfig => {
      if (rowConfig.label !== undefined) {
        updateCellValue(rowConfig.row, 0, rowConfig.label, { skipUndo: true, metricRangeId: normalizedConfig.id })
      }
      uniqueSortedColumns.forEach(col => {
        updateCellValue(rowConfig.row, col, rowConfig.formula, {
          skipUndo: true,
          metricRangeId: normalizedConfig.id,
        })
      })
    })

    if (activeSheet) {
      updateSheetMetricRanges(activeSheet.id, {
        ...metricRanges,
        [normalizedConfig.id]: normalizedConfig,
      })
    }

    setHoveredMetricRangeId(normalizedConfig.id)
  }, [activeSheet, metricRanges, updateCellValue, updateSheetMetricRanges])

  const getMetricRange = useCallback((id: string): MetricRangeConfig | null => {
    return metricRanges[id] ?? null
  }, [metricRanges])

  const performUndo = useCallback(() => {
    if (undoStack.length === 0) return

    const action = undoStack[undoStack.length - 1]
    setUndoStack(prev => prev.slice(0, -1))
    setRedoStack(prev => [...prev, action])

    // Apply the old values
    action.changes.forEach(({ row, col, oldValue, oldMetricRangeId }) => {
      updateCellValue(row, col, oldValue, { skipUndo: true, metricRangeId: oldMetricRangeId ?? null })
    })
  }, [undoStack, updateCellValue])

  const performRedo = useCallback(() => {
    if (redoStack.length === 0) return

    const action = redoStack[redoStack.length - 1]
    setRedoStack(prev => prev.slice(0, -1))
    setUndoStack(prev => [...prev, action])

    // Apply the new values
    action.changes.forEach(({ row, col, newValue, newMetricRangeId }) => {
      updateCellValue(row, col, newValue, { skipUndo: true, metricRangeId: newMetricRangeId ?? null })
    })
  }, [redoStack, updateCellValue])

  const clearSelectedCells = useCallback(() => {
    const envelope = getSelectionEnvelope()
    if (!envelope) return

    const changes: Array<{
      row: number
      col: number
      oldValue: string
      newValue: string
      oldMetricRangeId?: string | null
      newMetricRangeId?: string | null
    }> = []

    for (let row = envelope.start.row; row <= envelope.end.row; row++) {
      for (let col = envelope.start.col; col <= envelope.end.col; col++) {
        const oldValue = gridData[row]?.[col]?.raw ?? ""
        const oldMetricRangeId = gridData[row]?.[col]?.metricRangeId ?? null
        if (oldValue !== "") {
          changes.push({
            row,
            col,
            oldValue,
            newValue: "",
            oldMetricRangeId,
            newMetricRangeId: null,
          })
        }
      }
    }

    if (changes.length > 0) {
      // Add to undo stack as a bulk change
      setUndoStack(prev => [...prev, {
        type: 'bulk-change',
        changes
      }])
      setRedoStack([])

      // Clear all cells
      changes.forEach(({ row, col }) => {
        updateCellValue(row, col, "", { skipUndo: true, metricRangeId: null })
      })
    }
  }, [getSelectionEnvelope, gridData, updateCellValue])

  const findEdgeCell = useCallback((startRow: number, startCol: number, dRow: number, dCol: number): { row: number; col: number } => {
    const isBlank = (r: number, c: number) => {
      const value = gridData[r]?.[c]?.raw ?? ""
      return value.trim() === ""
    }

    let currentRow = startRow
    let currentCol = startCol

    // Check the next cell first
    const nextRow = currentRow + dRow
    const nextCol = currentCol + dCol

    // Check bounds for next cell
    if (nextRow < 0 || nextRow >= NUM_ROWS || nextCol < 0 || nextCol >= columns.length) {
      // Can't move further, stay at current position
      return { row: currentRow, col: currentCol }
    }

    const currentIsBlank = isBlank(currentRow, currentCol)
    const nextIsBlank = isBlank(nextRow, nextCol)

    if (currentIsBlank) {
      // Starting in blank: jump to first non-blank cell in direction
      currentRow = nextRow
      currentCol = nextCol

      while (true) {
        if (!isBlank(currentRow, currentCol)) {
          // Found first non-blank cell
          return { row: currentRow, col: currentCol }
        }

        const scanNextRow = currentRow + dRow
        const scanNextCol = currentCol + dCol

        // Check bounds
        if (scanNextRow < 0 || scanNextRow >= NUM_ROWS || scanNextCol < 0 || scanNextCol >= columns.length) {
          // Hit boundary
          return { row: currentRow, col: currentCol }
        }

        currentRow = scanNextRow
        currentCol = scanNextCol
      }
    } else if (nextIsBlank) {
      // Current has data, next is blank: skip blanks to find next data region
      currentRow = nextRow
      currentCol = nextCol

      while (true) {
        if (!isBlank(currentRow, currentCol)) {
          // Found first cell of next data region
          return { row: currentRow, col: currentCol }
        }

        const scanNextRow = currentRow + dRow
        const scanNextCol = currentCol + dCol

        // Check bounds
        if (scanNextRow < 0 || scanNextRow >= NUM_ROWS || scanNextCol < 0 || scanNextCol >= columns.length) {
          // Hit boundary in blank region, stay at boundary
          return { row: currentRow, col: currentCol }
        }

        currentRow = scanNextRow
        currentCol = scanNextCol
      }
    } else {
      // Both current and next have data: find edge of current data region
      currentRow = nextRow
      currentCol = nextCol

      while (true) {
        const scanNextRow = currentRow + dRow
        const scanNextCol = currentCol + dCol

        // Check bounds
        if (scanNextRow < 0 || scanNextRow >= NUM_ROWS || scanNextCol < 0 || scanNextCol >= columns.length) {
          // Hit boundary, current is the edge
          return { row: currentRow, col: currentCol }
        }

        if (isBlank(scanNextRow, scanNextCol)) {
          // Next is blank, current is the edge
          return { row: currentRow, col: currentCol }
        }

        // Keep moving
        currentRow = scanNextRow
        currentCol = scanNextCol
      }
    }
  }, [gridData])

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
          } else if (value.startsWith("=")) {
            // For external pastes or when internal metadata is unavailable,
            // still adjust formula references based on the paste position
            // Assume the formula was copied from the top-left of the paste range
            const sourceRow = target.row
            const sourceCol = target.col
            value = adjustFormulaReferences(
              value,
              destRow - sourceRow,
              destCol - sourceCol,
            )
          }

          updateCellValue(destRow, destCol, value, { metricRangeId: null })
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
          updateCellValue(row, col, "", { metricRangeId: null })
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
    const isEditing = Boolean(editingCell)
    if (isEditing && activeSheet && !editingSheetIdRef.current) {
      editingSheetIdRef.current = activeSheet.id
    }
    const statePayload = {
      isEditing,
      sheetId: editingSheetIdRef.current,
      isFormula: isEditing ? editValue.startsWith("=") : false,
    }
    const prev = previousEditingStateRef.current
    if (
      prev.isEditing !== statePayload.isEditing ||
      prev.sheetId !== statePayload.sheetId ||
      prev.isFormula !== statePayload.isFormula
    ) {
      previousEditingStateRef.current = statePayload
      onEditingStateChange?.(statePayload)
    }
    if (!isEditing && editingSheetIdRef.current) {
      editingSheetIdRef.current = null
    }
  }, [editingCell, editValue, activeSheet, onEditingStateChange])

  useEffect(() => {
    return () => {
      finalizeReferenceSelection()
    }
  }, [finalizeReferenceSelection])

  const startReferenceSelection = useCallback(
    (
      row: number,
      col: number,
      options: { bindMouseUp?: boolean; sheetId?: string | null; sheetName?: string | null } = { bindMouseUp: true }
    ) => {
      const input = inputRef.current
      if (!input) return

      if (referenceSelectionActiveRef.current) {
        finalizeReferenceSelection()
      }

      const currentValue = input.value
      const selectionStart = input.selectionStart ?? currentValue.length
      const selectionEnd = input.selectionEnd ?? selectionStart
      const sheetId = options.sheetId ?? activeSheet?.id ?? null
      const sheetName = options.sheetName ?? activeSheet?.name ?? null
      const includeSheetPrefix =
        Boolean(sheetId && editingSheetIdRef.current && sheetId !== editingSheetIdRef.current)
      const address = getCellAddress(row, col)
      const prefix = includeSheetPrefix ? formatSheetPrefix(sheetName ?? "") : ""
      const addressToken = `${prefix}${address}`
      const before = currentValue.slice(0, selectionStart)
      const after = currentValue.slice(selectionEnd)
      const nextValue = `${before}${addressToken}${after}`
      const insertionStart = before.length
      const insertionEnd = insertionStart + addressToken.length

      pendingReferenceRef.current = {
        startIndex: insertionStart,
        endIndex: insertionEnd,
        anchor: { row, col },
        sheetId,
        sheetName,
        includeSheetPrefix,
      }
      referenceSelectionActiveRef.current = true
      setReferencePreview({
        start: { row, col },
        end: { row, col },
        sheetId,
      })
      setEditValue(nextValue)
      computeFunctionSuggestions(nextValue)
      keyboardReferenceCursorRef.current = { row, col, sheetId }
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        inputRef.current?.setSelectionRange(insertionEnd, insertionEnd)
      })
      if (options.bindMouseUp) {
        window.addEventListener("mouseup", finalizeReferenceSelection)
      }
    },
    [activeSheet?.id, activeSheet?.name, computeFunctionSuggestions, finalizeReferenceSelection]
  )

  const updateReferenceSelection = useCallback(
    (row: number, col: number) => {
      if (!referenceSelectionActiveRef.current) {
        return
      }
      const pending = pendingReferenceRef.current
      if (!pending) return
      if (pending.sheetId && activeSheet && pending.sheetId !== activeSheet.id) {
        return
      }

      const anchor = pending.anchor
      const startRow = Math.min(anchor.row, row)
      const endRow = Math.max(anchor.row, row)
      const startCol = Math.min(anchor.col, col)
      const endCol = Math.max(anchor.col, col)

      const startAddress = getCellAddress(startRow, startCol)
      const endAddress = getCellAddress(endRow, endCol)
      const cellReference =
        startRow === endRow && startCol === endCol ? getCellAddress(anchor.row, anchor.col) : `${startAddress}:${endAddress}`
      const prefix = pending.includeSheetPrefix ? formatSheetPrefix(pending.sheetName ?? "") : ""
      const referenceString = `${prefix}${cellReference}`

      setReferencePreview({
        start: { row: startRow, col: startCol },
        end: { row: endRow, col: endCol },
        sheetId: pending.sheetId,
      })

      setEditValue((prev) => {
        const currentPending = pendingReferenceRef.current
        if (!currentPending) return prev

        // Ensure we get the exact current state of the indices
        const startIdx = currentPending.startIndex
        const endIdx = currentPending.endIndex

        const before = prev.slice(0, startIdx)
        const after = prev.slice(endIdx)
        const next = `${before}${referenceString}${after}`

        if (next === prev) {
          return prev
        }

        // Update the end index based on the new reference string length
        currentPending.endIndex = startIdx + referenceString.length
        return next
      })

      requestAnimationFrame(() => {
        const currentPending = pendingReferenceRef.current
        if (currentPending) {
          inputRef.current?.setSelectionRange(currentPending.endIndex, currentPending.endIndex)
        }
      })
      keyboardReferenceCursorRef.current = { row, col, sheetId: pending.sheetId }
    },
    [activeSheet]
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

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    const cell = gridData[row]?.[col]
    const value = cell?.raw || ""
    editingSourceRef.current = 'grid'
    setEditingCell({ row, col })
    setEditValue(value)
  }, [gridData])

  const handleCellMouseDown = useCallback((event: ReactMouseEvent<HTMLDivElement>, row: number, col: number) => {
    if (editingCell) {
      const currentValue = inputRef.current?.value ?? editValue
      const isFormulaEdit = currentValue.startsWith("=")
      const isSameCell = editingCell.row === row && editingCell.col === col
      const currentSheetId = activeSheet?.id ?? null
      const currentSheetName = activeSheet?.name ?? null

      if (isFormulaEdit) {
        event.preventDefault()
        event.stopPropagation()
        if (!isSameCell) {
          startReferenceSelection(row, col, { sheetId: currentSheetId, sheetName: currentSheetName })
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
  }, [activeSheet?.id, activeSheet?.name, editingCell, editValue, startReferenceSelection, finalizeReferenceSelection, addCellToSelection, extendSelectionTo, selectSingleCell, stopSelectionDragging, onCellClick])

  const handleCellMouseEnter = useCallback((event: ReactMouseEvent<HTMLDivElement>, row: number, col: number) => {
    if (selectionDraggingRef.current && !editingCell) {
      suppressSelectionSyncRef.current = true
      extendSelectionTo(row, col)
      return
    }

    if (referenceSelectionActiveRef.current) {
      event.preventDefault()
      event.stopPropagation()
      updateReferenceSelection(row, col)
      return
    }

    const metricId = gridData[row]?.[col]?.metricRangeId ?? null
    setHoveredMetricRangeId(prev => (prev === metricId ? prev : metricId))
  }, [editingCell, extendSelectionTo, updateReferenceSelection, gridData])

  const applyFormatting = useCallback((format: Partial<CellFormat>) => {
    const envelope = getSelectionEnvelope()
    if (!envelope) return

    setGridData(prevData => {
      const newData = prevData.map(rowArr => [...rowArr])

      for (let row = envelope.start.row; row <= envelope.end.row; row++) {
        for (let col = envelope.start.col; col <= envelope.end.col; col++) {
          if (!newData[row]) {
            newData[row] = Array.from({ length: columns.length }, () => ({ raw: "" }))
          }
          const cell = newData[row][col] || { raw: "" }
          newData[row][col] = {
            ...cell,
            format: {
              ...cell.format,
              ...format
            }
          }
        }
      }

      return newData
    })
  }, [getSelectionEnvelope, setGridData])

  const getSelectionFormat = useCallback((): CellFormat | null => {
    const envelope = getSelectionEnvelope()
    if (!envelope) return null

    // Get format from first cell in selection
    const firstCell = gridData[envelope.start.row]?.[envelope.start.col]
    return firstCell?.format || {}
  }, [getSelectionEnvelope, gridData])

  const handleCellKeyDown = useCallback((e: KeyboardEvent, row: number, col: number) => {
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
      if (key === "b") {
        e.preventDefault()
        const currentFormat = getSelectionFormat()
        applyFormatting({ bold: !currentFormat?.bold })
        return
      }
      if (key === "i") {
        e.preventDefault()
        const currentFormat = getSelectionFormat()
        applyFormatting({ italic: !currentFormat?.italic })
        return
      }
      if (key === "u") {
        e.preventDefault()
        const currentFormat = getSelectionFormat()
        applyFormatting({ underline: !currentFormat?.underline })
        return
      }
      if (key === "z") {
        e.preventDefault()
        if (e.shiftKey) {
          performRedo()
        } else {
          performUndo()
        }
        return
      }
      if (key === "y") {
        e.preventDefault()
        performRedo()
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

          let targetRow: number
          let targetCol: number

          // Cmd/Ctrl + Arrow: Jump to edge of data region
          if (e.metaKey || e.ctrlKey) {
            const edge = findEdgeCell(baseRow, baseCol, dRow, dCol)
            targetRow = edge.row
            targetCol = edge.col
          } else {
            targetRow = clamp(baseRow + dRow, 0, NUM_ROWS - 1)
            targetCol = clamp(baseCol + dCol, 0, columns.length - 1)
          }

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
          clearSelectedCells()
          break
        default:
          // Start editing on any character key
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            editingSourceRef.current = 'grid'
            setEditingCell({ row, col })
            setEditValue(e.key)
          }
      }
    }
  }, [
    editingCell,
    copySelection,
    pasteFromClipboard,
    cutSelection,
    performUndo,
    performRedo,
    applySelection,
    onCellClick,
    extendSelectionTo,
    selectSingleCell,
    clearSelectedCells,
    findEdgeCell,
    getSelectionEnvelope,
    getSelectionFormat,
    applyFormatting,
    handleCellDoubleClick
  ])

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
        // Start new reference selection from active cell
        const anchorRow = activeCell.row
        const anchorCol = activeCell.col
        const nextRow = clamp(anchorRow + dRow, 0, NUM_ROWS - 1)
        const nextCol = clamp(anchorCol + dCol, 0, columns.length - 1)

        if (e.shiftKey) {
          startReferenceSelection(anchorRow, anchorCol, {
            bindMouseUp: false,
            sheetId: activeSheet?.id ?? null,
            sheetName: activeSheet?.name ?? null,
          })
          updateReferenceSelection(nextRow, nextCol)
        } else {
          startReferenceSelection(nextRow, nextCol, {
            bindMouseUp: false,
            sheetId: activeSheet?.id ?? null,
            sheetName: activeSheet?.name ?? null,
          })
        }
        return
      }

      // Continue existing reference selection
      const pending = pendingReferenceRef.current
      const targetRow = clamp(currentCursor.row + dRow, 0, NUM_ROWS - 1)
      const targetCol = clamp(currentCursor.col + dCol, 0, columns.length - 1)
      if (pending?.sheetId && currentCursor.sheetId && pending.sheetId !== currentCursor.sheetId) {
        return
      }

      if (e.shiftKey) {
        updateReferenceSelection(targetRow, targetCol)
      } else {
        // Replace current reference with new cell (update anchor and indices)
        if (pending) {
          const input = inputRef.current
          if (input) {
            const currentValue = input.value
            const address = getCellAddress(targetRow, targetCol)
            const prefix = pending.includeSheetPrefix ? formatSheetPrefix(pending.sheetName ?? "") : ""
            const referenceToken = `${prefix}${address}`
            const before = currentValue.slice(0, pending.startIndex)
            const after = currentValue.slice(pending.endIndex)
            const nextValue = `${before}${referenceToken}${after}`

            pending.anchor = { row: targetRow, col: targetCol }
            pending.endIndex = pending.startIndex + referenceToken.length

            setEditValue(nextValue)
            setReferencePreview({
              start: { row: targetRow, col: targetCol },
              end: { row: targetRow, col: targetCol },
              sheetId: pending.sheetId,
            })
            keyboardReferenceCursorRef.current = { row: targetRow, col: targetCol, sheetId: pending.sheetId }

            requestAnimationFrame(() => {
              inputRef.current?.setSelectionRange(pending.endIndex, pending.endIndex)
            })
          }
        }
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
      const targetSheetId = editingSheetIdRef.current ?? activeSheet?.id ?? null
      if (targetSheetId && activeSheet && activeSheet.id !== targetSheetId) {
        setActiveSheet(targetSheetId)
      }
      updateCellValue(editingCell.row, editingCell.col, editValue, { metricRangeId: null }, { sheetId: targetSheetId })
      setEditingCell(null)
      editingSourceRef.current = null
      editingSheetIdRef.current = null
    }
  }, [activeSheet, editValue, editingCell, finalizeReferenceSelection, setActiveSheet, setFunctionSuggestions, updateCellValue])

  const cancelEdit = useCallback(() => {
    finalizeReferenceSelection()
    setFunctionSuggestions([])
    if (editingSheetIdRef.current && activeSheet && activeSheet.id !== editingSheetIdRef.current) {
      setActiveSheet(editingSheetIdRef.current)
    }
    setEditingCell(null)
    setEditValue("")
    editingSourceRef.current = null
    editingSheetIdRef.current = null
  }, [activeSheet, finalizeReferenceSelection, setActiveSheet, setFunctionSuggestions])

  useImperativeHandle(
    ref,
    () => ({
      setFormulaDraft: (value: string, options?: { focusCell?: boolean; source?: 'grid' | 'formulaBar' }) => {
        const { focusCell = true, source = 'grid' } = options ?? {}
        const target = { row: activeCell.row, col: activeCell.col }
        editingSourceRef.current = source
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
        if (!editingSheetIdRef.current && activeSheet) {
          editingSheetIdRef.current = activeSheet.id
        }

        if (focusCell) {
          requestAnimationFrame(() => {
            inputRef.current?.focus()
            const cursor = value.length
            inputRef.current?.setSelectionRange(cursor, cursor)
          })
        }
      },
      commitFormulaDraft: (value: string) => {
        setFunctionSuggestions([])
        finalizeReferenceSelection()
        setEditValue(value)
        const targetSheetId = editingSheetIdRef.current ?? activeSheet?.id ?? null
        if (targetSheetId && activeSheet && activeSheet.id !== targetSheetId) {
          setActiveSheet(targetSheetId)
        }
        updateCellValue(activeCell.row, activeCell.col, value, { metricRangeId: null }, { sheetId: targetSheetId })
        setEditingCell(null)
        editingSourceRef.current = null
        editingSheetIdRef.current = null
      },
      setCellValue: (
        row: number,
        col: number,
        value: string,
        options?: { skipUndo?: boolean; metricRangeId?: string | null; sheetId?: string | null }
      ) => {
        finalizeReferenceSelection()
        setFunctionSuggestions([])
        setEditingCell(null)
        updateCellValue(
          row,
          col,
          value,
          { skipUndo: options?.skipUndo ?? false, metricRangeId: options?.metricRangeId },
          { sheetId: options?.sheetId ?? editingSheetIdRef.current ?? activeSheet?.id ?? null }
        )
        editingSourceRef.current = null
        if (options?.sheetId && editingSheetIdRef.current === options.sheetId) {
          editingSheetIdRef.current = null
        }
      },
      cancelFormulaDraft: () => {
        cancelEdit()
        editingSourceRef.current = null
      },
      toggleReferenceAnchor: () => {
        toggleReferenceAnchors()
      },
      applyFormatting,
      getSelectionFormat,
      getGridData: () => gridData,
      applyMetricRange,
      getMetricRange,
      getMetricRanges: () => metricRanges,
      getMetricCells: () => metricCells,
      preserveEditOnNextBlur: () => {
        preserveEditOnBlurRef.current = true
      },
      getEditingContext: () => ({
        isEditing: Boolean(editingCell),
        sheetId: editingSheetIdRef.current,
        isFormula: Boolean(editingCell && editValue.startsWith("=")),
      }),
    }),
    [
      activeCell.col,
      activeCell.row,
      cancelEdit,
      computeFunctionSuggestions,
      finalizeReferenceSelection,
      toggleReferenceAnchors,
      updateCellValue,
      applyFormatting,
      getSelectionFormat,
      gridData,
      applyMetricRange,
      getMetricRange,
      metricRanges,
      metricCells,
      activeSheet,
      setActiveSheet,
      editValue,
      editingCell,
    ]
  )

  const handleInputBlur = (event: ReactFocusEvent<HTMLInputElement>) => {
    if (preserveEditOnBlurRef.current) {
      preserveEditOnBlurRef.current = false
      event.preventDefault()
      return
    }
    commitEdit()
  }

  return (
    <div className="relative" onMouseLeave={() => setHoveredMetricRangeId(null)}>
      {/* Column Headers */}
      <div className="sticky top-0 z-20 flex border-b border-border bg-muted select-none">
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
                "relative flex w-12 shrink-0 items-center justify-center border-r border-border bg-muted font-mono text-xs font-medium select-none",
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
              const cellData = gridData[rowIdx]?.[colIdx]
              const rawValue = cellData?.raw ?? ""
              const cellFormat = cellData?.format
              const metricRangeId = cellData?.metricRangeId ?? null
              const rangeConfig = metricRangeId ? metricRanges[metricRangeId] : undefined
              const isRowInMetricRange = rangeConfig?.rows.some(r => r.row === rowIdx) ?? false
              const isFormula = rawValue.startsWith("=")
              const isMetric = isMetricFormula(rawValue)
              const cellKey = `${rowIdx},${colIdx}`
              const metricResult = metricCells[cellKey]
              const engineValue = isFormula && !isMetric ? getEngineValue(rowIdx, colIdx) : null

              // Get the computed value from HyperFormula for consistent formatting
              const computedValue = isFormula && !isMetric ? engineValue : (isFormula ? null : getEngineValue(rowIdx, colIdx))
              const wasDateParsed = !isFormula && typeof computedValue === 'number' && parseDateStringToSerial(rawValue) !== null

              let displayValue: string
              if (isMetric) {
                if (!metricResult) {
                  displayValue = "..."
                } else if (metricResult.loading) {
                  displayValue = "Loading..."
                } else if (metricResult.error) {
                  displayValue = "#ERROR!"
                } else if (metricResult.value !== null && metricResult.value !== undefined) {
                  displayValue =
                    typeof metricResult.value === 'number'
                      ? numberFormatter.format(metricResult.value)
                      : String(metricResult.value)
                } else {
                  displayValue = ""
                }
              } else if (!isFormula && !computedValue) {
                // No computed value available, show raw
                displayValue = rawValue
              } else if (cellFormat?.numberFormat === 'text') {
                // Explicit text format: show raw value
                displayValue = rawValue
              } else if (cellFormat?.numberFormat === 'date' && typeof computedValue === 'number') {
                // Explicit date format
                const formatted = formatDateValue(computedValue)
                displayValue = formatted ?? rawValue
              } else if (cellFormat?.numberFormat === 'currency' && typeof computedValue === 'number') {
                displayValue = `$${numberFormatter.format(computedValue)}`
              } else if (cellFormat?.numberFormat === 'percentage' && typeof computedValue === 'number') {
                displayValue = percentFormatter.format(computedValue)
              } else if (cellFormat?.numberFormat === 'general' && typeof computedValue === 'number') {
                // Explicit general/number format
                displayValue = numberFormatter.format(computedValue)
              } else if (wasDateParsed) {
                // Auto-detected date (no explicit format): format as date (Excel behavior)
                const formatted = formatDateValue(computedValue as number)
                displayValue = formatted ?? rawValue
              } else if (typeof computedValue === 'number') {
                // Number value without specific format
                displayValue = formatComputedValue(rowIdx, computedValue)
              } else if (computedValue instanceof DetailedCellError) {
                displayValue = computedValue.value ?? computedValue.message ?? "#ERROR!"
              } else if (computedValue !== null && computedValue !== undefined) {
                displayValue = String(computedValue)
              } else if (isFormula) {
                // Formula that evaluates to empty/null (e.g., reference to empty cell)
                displayValue = ""
              } else {
                displayValue = rawValue
              }

              const isActive = activeCell.row === rowIdx && activeCell.col === colIdx
              const isEditing = editingCell?.row === rowIdx && editingCell?.col === colIdx
              const isHeader = colIdx === 0 && rawValue !== ""
              const numericFromFormula = typeof engineValue === "number"
              const numericFromMetric = isMetric && typeof metricResult?.value === 'number'
              const hasNumericComputedValue = typeof computedValue === 'number'
              const isNumeric =
                (!isFormula && rawValue !== "" && /^[\d,]+$/.test(rawValue.replace(/[%$]/g, ""))) ||
                numericFromFormula ||
                numericFromMetric ||
                hasNumericComputedValue
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
              // Optimized selection check using Set lookup instead of iterating ranges
              const isSelected = selectedCellsSet.has(`${rowIdx},${colIdx}`)

              // Check if this cell is in a detected date range (both row and column must match)
              const dateRange = detectedRanges.find(r =>
                r.rowIndex === rowIdx &&
                colIdx >= r.startCol &&
                colIdx <= r.endCol
              )
              const isInDateRange = dateRange !== undefined
              const isNewDateRange = dateRange?.isNew || false

              const metricHighlight =
                !!rangeConfig &&
                isRowInMetricRange &&
                (metricRangeId === activeMetricRangeId || metricRangeId === hoveredMetricRangeId)

              const highlightStyle = activeHighlight
                ? {
                    boxShadow: `inset 0 0 0 2px ${activeHighlight.color}`,
                    backgroundColor: `${activeHighlight.color}1A`,
                  }
                : undefined

              const combinedStyle: CSSProperties = { width: columnWidths[colIdx], ...highlightStyle }
              if (metricHighlight) {
                const metricBoxShadow = "inset 0 0 0 2px rgba(59,130,246,0.35)"
                combinedStyle.boxShadow = combinedStyle.boxShadow
                  ? `${combinedStyle.boxShadow}, ${metricBoxShadow}`
                  : metricBoxShadow
              }

              const showEditMetric =
                !!rangeConfig &&
                onEditMetricRange &&
                hoveredMetricRangeId === metricRangeId &&
                rangeConfig.rows[0]?.row === rowIdx &&
                rangeConfig.columns[0] !== undefined &&
                colIdx === rangeConfig.columns[0] &&
                !isEditing

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
                  onMouseLeave={() => {
                    if (metricRangeId && hoveredMetricRangeId === metricRangeId) {
                      setHoveredMetricRangeId(null)
                    }
                  }}
                  onDoubleClick={() => handleCellDoubleClick(rowIdx, colIdx)}
                  onKeyDown={(e) => handleCellKeyDown(e, rowIdx, colIdx)}
                  onCopy={handleCopyEvent}
                  onCut={handleCutEvent}
                  onPaste={handlePasteEvent}
                  tabIndex={isActive ? 0 : -1}
                  className={cn(
                    "relative flex h-full shrink-0 cursor-cell items-center border-r border-border px-2 text-sm transition-colors select-none",
                    isActive && "ring-2 ring-primary ring-inset z-10",
                    isHeader && "bg-muted font-medium text-foreground",
                    !isHeader && "bg-card text-foreground hover:bg-accent",
                    isNumeric && !isEditing && "justify-end font-mono",
                    isPercentage && "text-success",
                    isFormula && "text-primary font-mono",
                    isSelected && !isActive && !activeHighlight && "bg-primary/5",
                    metricHighlight && "bg-primary/5 outline outline-1 outline-primary/40 outline-offset-[-2px]",
                    // Apply cell formatting
                    cellFormat?.bold && "font-bold",
                    cellFormat?.italic && "italic pr-4",
                    cellFormat?.underline && "underline",
                    cellFormat?.align === 'left' && "justify-start",
                    cellFormat?.align === 'center' && "justify-center",
                    cellFormat?.align === 'right' && "justify-end",
                    // Date range detection effects
                    isNewDateRange && !isHeader && "shimmer-effect",
                    isInDateRange && !isNewDateRange && !isHeader && "bg-blue-50/30 dark:bg-blue-950/10",
                  )}
                  style={combinedStyle}
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
                    <span className={cn("truncate", cellFormat?.italic && "pr-1")}>{displayValue}</span>
                  )}
                  {showEditMetric && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onEditMetricRange?.(rangeConfig)
                      }}
                      className="absolute right-1 top-1 rounded-full border border-primary/30 bg-background px-2 py-0.5 text-xs font-medium text-primary shadow-sm hover:bg-primary/10"
                    >
                      Edit Metric
                    </button>
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
