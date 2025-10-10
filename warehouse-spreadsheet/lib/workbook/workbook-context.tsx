"use client"

import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from "react"
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
  workbookName: string
  sheets: Sheet[]
  activeSheetId: string
  activeSheet: Sheet | null
  hasUnsavedChanges: boolean
  lastSavedAt: Date | null
  addSheet: (name?: string) => string
  deleteSheet: (sheetId: string) => void
  renameSheet: (sheetId: string, newName: string) => void
  setActiveSheet: (sheetId: string) => void
  updateSheetData: (sheetId: string, gridData: CellContent[][]) => void
  updateSheetMetricRanges: (sheetId: string, metricRanges: Record<string, MetricRangeConfig>) => void
  updateSheetMetricCells: (sheetId: string, metricCells: Record<string, MetricCellResult>) => void
  getSheet: (sheetId: string) => Sheet | null
  getSheetByName: (name: string) => Sheet | null
  loadWorkbookData?: (workbook: any) => void
  saveWorkbookData?: (workbookId: string) => Promise<boolean>
  markDirty: () => void
  markClean: () => void
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

  const [workbookName, setWorkbookName] = useState<string>("Untitled Workbook")
  const [sheets, setSheets] = useState<Sheet[]>(() => [
    {
      id: nanoid(),
      name: "Sheet1",
      gridData: createEmptyGridData(),
      metricRanges: {},
      metricCells: {},
    }
  ])

  const [activeSheetId, setActiveSheetId] = useState<string>(() => sheets[0]?.id || "")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  const activeSheet = sheets.find(s => s.id === activeSheetId) || null
  
  const markDirty = useCallback(() => {
    setHasUnsavedChanges(true)
  }, [])
  
  const markClean = useCallback(() => {
    setHasUnsavedChanges(false)
    setLastSavedAt(new Date())
  }, [])

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
    markDirty()
  }, [markDirty])

  const updateSheetMetricRanges = useCallback((sheetId: string, metricRanges: Record<string, MetricRangeConfig>) => {
    setSheets(prev => prev.map(sheet =>
      sheet.id === sheetId ? { ...sheet, metricRanges } : sheet
    ))
    markDirty()
  }, [markDirty])

  const updateSheetMetricCells = useCallback((sheetId: string, metricCells: Record<string, MetricCellResult>) => {
    setSheets(prev => prev.map(sheet =>
      sheet.id === sheetId ? { ...sheet, metricCells } : sheet
    ))
    // Don't mark dirty for metric cell updates - these are calculated values, not user edits
  }, [])

  const getSheet = useCallback((sheetId: string): Sheet | null => {
    return sheets.find(s => s.id === sheetId) || null
  }, [sheets])

  const getSheetByName = useCallback((name: string): Sheet | null => {
    return sheets.find(s => s.name === name) || null
  }, [sheets])

  // Helper function to convert old flat coordinate format to gridData array format
  const convertCellDataFormat = useCallback((cell_data: any): { gridData: CellContent[][], metricRanges: Record<string, MetricRangeConfig>, metricCells: Record<string, MetricCellResult> } => {
    // If no data, return empty
    if (!cell_data || Object.keys(cell_data).length === 0) {
      return {
        gridData: createEmptyGridData(),
        metricRanges: {},
        metricCells: {},
      }
    }
    
    // If already in new format with gridData array
    if (cell_data.gridData && Array.isArray(cell_data.gridData)) {
      return {
        gridData: cell_data.gridData.length > 0 ? cell_data.gridData : createEmptyGridData(),
        metricRanges: cell_data.metricRanges || {},
        metricCells: cell_data.metricCells || {},
      }
    }
    
    // Convert old flat coordinate format like {"0,1": {raw: "Q1 2024"}}
    const gridData = createEmptyGridData()
    for (const [key, value] of Object.entries(cell_data)) {
      if (key.includes(',')) {
        const [row, col] = key.split(',').map(Number)
        if (gridData[row] && gridData[row][col]) {
          gridData[row][col] = value as CellContent
        }
      }
    }
    
    return {
      gridData,
      metricRanges: {},
      metricCells: {},
    }
  }, [])

  const loadWorkbookData = useCallback((workbook: any) => {
    console.log('[WorkbookContext] Loading workbook data:', workbook)
    
    // Set workbook name
    if (workbook.name) {
      setWorkbookName(workbook.name)
    }
    
    if (workbook.sheets && workbook.sheets.length > 0) {
      const loadedSheets = workbook.sheets.map((sheet: any) => {
        // Convert cell_data to the expected format
        const cellData = convertCellDataFormat(sheet.cell_data)
        
        return {
          id: sheet.id,
          name: sheet.name || 'Untitled',
          gridData: cellData.gridData,
          metricRanges: cellData.metricRanges,
          metricCells: cellData.metricCells,
        }
      })
      
      console.log('[WorkbookContext] Loaded sheets:', loadedSheets.map((s: Sheet) => ({ id: s.id, name: s.name })))
      setSheets(loadedSheets)
      setActiveSheetId(loadedSheets[0].id)
      // Mark as clean since we just loaded from DB
      setHasUnsavedChanges(false)
      setLastSavedAt(new Date())
    }
  }, [convertCellDataFormat])

  const saveWorkbookData = useCallback(async (workbookId: string) => {
    console.log('[WorkbookContext] Saving workbook:', workbookId)
    
    try {
      const sheetsToSave = sheets.map((sheet, index) => ({
        id: sheet.id,
        name: sheet.name,
        position: index,
        cell_data: {
          gridData: sheet.gridData,
          metricRanges: sheet.metricRanges,
          metricCells: sheet.metricCells,
        },
      }))

      console.log('[WorkbookContext] Saving cell_data structure:', {
        sheetCount: sheetsToSave.length,
        hasGridData: !!sheetsToSave[0]?.cell_data?.gridData,
        gridDataLength: sheetsToSave[0]?.cell_data?.gridData?.length,
        isArray: Array.isArray(sheetsToSave[0]?.cell_data?.gridData)
      })

      const response = await fetch(`/api/workbooks/${workbookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets: sheetsToSave }),
      })

      if (!response.ok) {
        throw new Error('Failed to save workbook')
      }

      console.log('[WorkbookContext] ✅ Workbook saved successfully')
      markClean()
      return true
    } catch (error) {
      console.error('[WorkbookContext] Save error:', error)
      return false
    }
  }, [sheets, markClean])

  const value: WorkbookContextValue = {
    workbookName,
    sheets,
    activeSheetId,
    activeSheet,
    hasUnsavedChanges,
    lastSavedAt,
    addSheet,
    deleteSheet,
    renameSheet,
    setActiveSheet: setActiveSheetFunc,
    updateSheetData,
    updateSheetMetricRanges,
    updateSheetMetricCells,
    getSheet,
    getSheetByName,
    loadWorkbookData,
    saveWorkbookData,
    markDirty,
    markClean,
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
