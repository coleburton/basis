/**
 * Sparse Storage Utilities
 *
 * Converts between dense grid format (used in UI) and sparse format (used in database).
 * This dramatically reduces storage size for spreadsheets where most cells are empty.
 *
 * Dense format: CellContent[][] (50 rows × 10 cols = 500 cells, even if most are empty)
 * Sparse format: { "row,col": CellContent } (only stores non-empty cells)
 */

import type { CellContent } from './workbook-context'

export interface SparseCell {
  raw: string
  format?: {
    bold?: boolean
    italic?: boolean
    underline?: boolean
    align?: 'left' | 'center' | 'right'
    numberFormat?: 'general' | 'currency' | 'percentage' | 'text' | 'date'
  }
  metricRangeId?: string | null
}

export type SparseCellData = Record<string, SparseCell>

/**
 * Convert dense grid data to sparse format
 * Only stores cells that have content (raw value, format, or metricRangeId)
 */
export function gridDataToSparse(gridData: CellContent[][]): SparseCellData {
  const sparse: SparseCellData = {}

  gridData.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      // Check if cell has any content worth storing
      const hasContent =
        cell.raw ||
        cell.format ||
        cell.metricRangeId

      if (hasContent) {
        const key = `${rowIdx},${colIdx}`
        sparse[key] = {
          raw: cell.raw,
          ...(cell.format && { format: cell.format }),
          ...(cell.metricRangeId && { metricRangeId: cell.metricRangeId })
        }
      }
    })
  })

  return sparse
}

/**
 * Convert sparse format back to dense grid data
 * Creates a full grid with empty cells where sparse data doesn't exist
 */
export function sparseToGridData(
  sparse: SparseCellData,
  numRows: number,
  numCols: number
): CellContent[][] {
  const grid: CellContent[][] = []

  // Initialize empty grid
  for (let i = 0; i < numRows; i++) {
    grid[i] = []
    for (let j = 0; j < numCols; j++) {
      const key = `${i},${j}`
      const sparseCell = sparse[key]

      if (sparseCell) {
        // Cell has data - use it
        grid[i][j] = {
          raw: sparseCell.raw || '',
          ...(sparseCell.format && { format: sparseCell.format }),
          ...(sparseCell.metricRangeId && { metricRangeId: sparseCell.metricRangeId })
        }
      } else {
        // Empty cell
        grid[i][j] = { raw: '' }
      }
    }
  }

  return grid
}

/**
 * Calculate the bounds (min/max row/col) of the sparse data
 * Useful for determining actual grid size
 */
export function getSparseBounds(sparse: SparseCellData): {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
  isEmpty: boolean
} {
  const keys = Object.keys(sparse)

  if (keys.length === 0) {
    return {
      minRow: 0,
      maxRow: 0,
      minCol: 0,
      maxCol: 0,
      isEmpty: true
    }
  }

  let minRow = Infinity
  let maxRow = -Infinity
  let minCol = Infinity
  let maxCol = -Infinity

  keys.forEach(key => {
    const [row, col] = key.split(',').map(Number)
    minRow = Math.min(minRow, row)
    maxRow = Math.max(maxRow, row)
    minCol = Math.min(minCol, col)
    maxCol = Math.max(maxCol, col)
  })

  return {
    minRow,
    maxRow,
    minCol,
    maxCol,
    isEmpty: false
  }
}

/**
 * Calculate storage savings from using sparse format
 * Returns percentage saved
 */
export function calculateStorageSavings(
  gridData: CellContent[][],
  sparse: SparseCellData
): {
  denseCells: number
  sparseCells: number
  savingsPercent: number
} {
  const denseCells = gridData.length * (gridData[0]?.length || 0)
  const sparseCells = Object.keys(sparse).length
  const savingsPercent = denseCells > 0
    ? Math.round(((denseCells - sparseCells) / denseCells) * 100)
    : 0

  return {
    denseCells,
    sparseCells,
    savingsPercent
  }
}

/**
 * Merge sparse updates into existing sparse data
 * Useful for incremental updates
 */
export function mergeSparseUpdates(
  existing: SparseCellData,
  updates: SparseCellData
): SparseCellData {
  const merged = { ...existing }

  Object.entries(updates).forEach(([key, cell]) => {
    // If cell is empty, remove it
    if (!cell.raw && !cell.format && !cell.metricRangeId) {
      delete merged[key]
    } else {
      merged[key] = cell
    }
  })

  return merged
}

/**
 * Get changed cells between two grid states
 * Returns sparse format of only the cells that changed
 */
export function getChangedCells(
  oldGrid: CellContent[][],
  newGrid: CellContent[][]
): {
  changes: SparseCellData
  hasChanges: boolean
} {
  const changes: SparseCellData = {}
  let hasChanges = false

  newGrid.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      const oldCell = oldGrid[rowIdx]?.[colIdx]

      // Check if cell changed
      const cellChanged =
        oldCell?.raw !== cell.raw ||
        JSON.stringify(oldCell?.format) !== JSON.stringify(cell.format) ||
        oldCell?.metricRangeId !== cell.metricRangeId

      if (cellChanged) {
        const key = `${rowIdx},${colIdx}`

        // If new cell is empty, mark for deletion
        if (!cell.raw && !cell.format && !cell.metricRangeId) {
          changes[key] = { raw: '' }
        } else {
          changes[key] = {
            raw: cell.raw,
            ...(cell.format && { format: cell.format }),
            ...(cell.metricRangeId && { metricRangeId: cell.metricRangeId })
          }
        }

        hasChanges = true
      }
    })
  })

  return { changes, hasChanges }
}

/**
 * Validate sparse cell data structure
 * Returns true if valid, throws error if invalid
 */
export function validateSparseData(sparse: unknown): sparse is SparseCellData {
  if (typeof sparse !== 'object' || sparse === null) {
    throw new Error('Sparse data must be an object')
  }

  const sparseObj = sparse as Record<string, unknown>

  for (const [key, value] of Object.entries(sparseObj)) {
    // Validate key format (should be "row,col")
    if (!/^\d+,\d+$/.test(key)) {
      throw new Error(`Invalid cell key format: ${key}`)
    }

    // Validate value structure
    if (typeof value !== 'object' || value === null) {
      throw new Error(`Invalid cell value for ${key}`)
    }

    const cell = value as Record<string, unknown>

    if ('raw' in cell && typeof cell.raw !== 'string') {
      throw new Error(`Cell ${key} has invalid raw value`)
    }
  }

  return true
}
