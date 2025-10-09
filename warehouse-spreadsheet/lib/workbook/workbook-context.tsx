"use client"

import { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react"
import { nanoid } from "nanoid"

export interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  numberFormat?: 'general' | 'currency' | 'percentage' | 'text' | 'date'
}

export interface CellContent {
  raw: string
  format?: CellFormat
  metricRangeId?: string | null
}

export interface MetricRangeRowConfig {
  row: number
  formula: string
  label?: string
}

export interface MetricRangeConfig {
  id: string
  metricId: string
  columns: number[]
  rows: MetricRangeRowConfig[]
  displayName?: string
  metadata?: Record<string, unknown>
}

export interface MetricCellResult {
  value: number | string | null
  loading: boolean
  error: string | null
}

export interface Sheet {
  id: string
  name: string
  gridData: CellContent[][]
  metricRanges: Record<string, MetricRangeConfig>
  metricCells: Record<string, MetricCellResult>
  hyperformulaSheetId?: number
}

export interface WorkbookContextValue {
  sheets: Sheet[]
  activeSheetId: string
  activeSheet: Sheet | null
  addSheet: (name?: string) => string
  deleteSheet: (sheetId: string) => void
  renameSheet: (sheetId: string, newName: string) => void
  setActiveSheet: (sheetId: string) => void
  updateSheetData: (sheetId: string, gridData: CellContent[][]) => void
  updateSheetMetricRanges: (sheetId: string, metricRanges: Record<string, MetricRangeConfig>) => void
  updateSheetMetricCells: (sheetId: string, metricCells: Record<string, MetricCellResult>) => void
  getSheet: (sheetId: string) => Sheet | null
  getSheetByName: (name: string) => Sheet | null
}

const WorkbookContext = createContext<WorkbookContextValue | null>(null)

// Create initial grid data
const createInitialGridData = (): CellContent[][] => {
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

  const NUM_ROWS = 50
  const NUM_COLS = 10
  const grid: CellContent[][] = []

  for (let i = 0; i < NUM_ROWS; i++) {
    grid[i] = []
    for (let j = 0; j < NUM_COLS; j++) {
      const initialValue = initialData[i]?.[j] ?? ""
      grid[i][j] = { raw: initialValue }
    }
  }

  return grid
}

const createEmptyGridData = (): CellContent[][] => {
  const NUM_ROWS = 50
  const NUM_COLS = 10
  const grid: CellContent[][] = []

  for (let i = 0; i < NUM_ROWS; i++) {
    grid[i] = []
    for (let j = 0; j < NUM_COLS; j++) {
      grid[i][j] = { raw: "" }
    }
  }

  return grid
}

export function WorkbookProvider({ children }: { children: ReactNode }) {
  const sheetCounter = useRef(1)

  const [sheets, setSheets] = useState<Sheet[]>(() => [
    {
      id: nanoid(),
      name: "Sheet1",
      gridData: createInitialGridData(),
      metricRanges: {},
      metricCells: {},
    }
  ])

  const [activeSheetId, setActiveSheetId] = useState<string>(() => sheets[0]?.id || "")

  const activeSheet = sheets.find(s => s.id === activeSheetId) || null

  const addSheet = useCallback((name?: string) => {
    const newSheetId = nanoid()
    const newSheetName = name || `Sheet${sheetCounter.current + 1}`
    sheetCounter.current++

    setSheets(prev => [
      ...prev,
      {
        id: newSheetId,
        name: newSheetName,
        gridData: createEmptyGridData(),
        metricRanges: {},
        metricCells: {},
      }
    ])

    return newSheetId
  }, [])

  const deleteSheet = useCallback((sheetId: string) => {
    setSheets(prev => {
      const filtered = prev.filter(s => s.id !== sheetId)

      // Don't allow deleting the last sheet
      if (filtered.length === 0) {
        return prev
      }

      // If we deleted the active sheet, switch to the first remaining sheet
      if (sheetId === activeSheetId) {
        setActiveSheetId(filtered[0].id)
      }

      return filtered
    })
  }, [activeSheetId])

  const renameSheet = useCallback((sheetId: string, newName: string) => {
    setSheets(prev => prev.map(sheet =>
      sheet.id === sheetId ? { ...sheet, name: newName } : sheet
    ))
  }, [])

  const setActiveSheetFunc = useCallback((sheetId: string) => {
    setActiveSheetId(sheetId)
  }, [])

  const updateSheetData = useCallback((sheetId: string, gridData: CellContent[][]) => {
    setSheets(prev => prev.map(sheet =>
      sheet.id === sheetId ? { ...sheet, gridData } : sheet
    ))
  }, [])

  const updateSheetMetricRanges = useCallback((sheetId: string, metricRanges: Record<string, MetricRangeConfig>) => {
    setSheets(prev => prev.map(sheet =>
      sheet.id === sheetId ? { ...sheet, metricRanges } : sheet
    ))
  }, [])

  const updateSheetMetricCells = useCallback((sheetId: string, metricCells: Record<string, MetricCellResult>) => {
    setSheets(prev => prev.map(sheet =>
      sheet.id === sheetId ? { ...sheet, metricCells } : sheet
    ))
  }, [])

  const getSheet = useCallback((sheetId: string): Sheet | null => {
    return sheets.find(s => s.id === sheetId) || null
  }, [sheets])

  const getSheetByName = useCallback((name: string): Sheet | null => {
    return sheets.find(s => s.name === name) || null
  }, [sheets])

  const value: WorkbookContextValue = {
    sheets,
    activeSheetId,
    activeSheet,
    addSheet,
    deleteSheet,
    renameSheet,
    setActiveSheet: setActiveSheetFunc,
    updateSheetData,
    updateSheetMetricRanges,
    updateSheetMetricCells,
    getSheet,
    getSheetByName,
  }

  return (
    <WorkbookContext.Provider value={value}>
      {children}
    </WorkbookContext.Provider>
  )
}

export function useWorkbook() {
  const context = useContext(WorkbookContext)
  if (!context) {
    throw new Error("useWorkbook must be used within WorkbookProvider")
  }
  return context
}
