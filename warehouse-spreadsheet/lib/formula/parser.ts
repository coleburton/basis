/**
 * Formula Parser
 * Parses spreadsheet formulas and extracts cell references
 */

export interface CellReference {
  type: 'cell';
  column: string;
  row: number;
}

export interface RangeReference {
  type: 'range';
  start: CellReference;
  end: CellReference;
}

export type Reference = CellReference | RangeReference;

export interface ParsedFormula {
  type: 'formula' | 'value';
  value?: string | number;
  function?: string;
  args?: (Reference | ParsedFormula | string | number)[];
  references: Reference[];
}

/**
 * Converts column letter(s) to column index (A=0, B=1, ..., Z=25, AA=26, etc.)
 */
export function columnToIndex(column: string): number {
  let index = 0;
  for (let i = 0; i < column.length; i++) {
    index = index * 26 + (column.charCodeAt(i) - 65 + 1);
  }
  return index - 1;
}

/**
 * Converts column index to column letter(s) (0=A, 1=B, ..., 25=Z, 26=AA, etc.)
 */
export function indexToColumn(index: number): string {
  let column = '';
  let num = index + 1;
  while (num > 0) {
    const remainder = (num - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    num = Math.floor((num - 1) / 26);
  }
  return column;
}

/**
 * Parses a cell reference like "A1" or "AA100"
 */
export function parseCellReference(ref: string): CellReference | null {
  const match = ref.match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;

  const [, column, row] = match;
  return {
    type: 'cell',
    column,
    row: parseInt(row, 10),
  };
}

/**
 * Parses a range reference like "A1:C100"
 */
export function parseRangeReference(ref: string): RangeReference | null {
  const match = ref.match(/^([A-Z]+\d+):([A-Z]+\d+)$/);
  if (!match) return null;

  const [, startRef, endRef] = match;
  const start = parseCellReference(startRef);
  const end = parseCellReference(endRef);

  if (!start || !end) return null;

  return {
    type: 'range',
    start,
    end,
  };
}

/**
 * Parses any reference (cell or range)
 */
export function parseReference(ref: string): Reference | null {
  return parseRangeReference(ref) || parseCellReference(ref);
}

/**
 * Extracts all cell and range references from a formula
 */
export function extractReferences(formula: string): Reference[] {
  const references: Reference[] = [];

  // Match range references first (A1:C100)
  const rangePattern = /([A-Z]+\d+):([A-Z]+\d+)/g;
  let match;

  while ((match = rangePattern.exec(formula)) !== null) {
    const ref = parseRangeReference(match[0]);
    if (ref) references.push(ref);
  }

  // Match individual cell references (A1, B2, etc.) that aren't part of ranges
  const cellPattern = /\b([A-Z]+\d+)\b/g;
  const processedRanges = new Set(
    references.flatMap(ref => {
      if (ref.type === 'range') {
        return [
          `${ref.start.column}${ref.start.row}`,
          `${ref.end.column}${ref.end.row}`
        ];
      }
      return [];
    })
  );

  while ((match = cellPattern.exec(formula)) !== null) {
    // Skip if this cell is part of a range we already found
    if (!processedRanges.has(match[1])) {
      const ref = parseCellReference(match[1]);
      if (ref) references.push(ref);
    }
  }

  return references;
}

/**
 * Parses a formula string into a structured format
 * Supports: =SUM(A1:C100), =A1+B2, =AVERAGE(A1,B1,C1), etc.
 */
export function parseFormula(formula: string): ParsedFormula {
  // Remove leading = if present
  const normalized = formula.trim().replace(/^=/, '');

  // Check if it's just a value (number or string)
  const numberValue = parseFloat(normalized);
  if (!isNaN(numberValue) && normalized === numberValue.toString()) {
    return {
      type: 'value',
      value: numberValue,
      references: [],
    };
  }

  // Extract all references for dependency tracking
  const references = extractReferences(normalized);

  // Check if it's a function call like SUM(A1:C100)
  const functionMatch = normalized.match(/^([A-Z]+)\((.*)\)$/);
  if (functionMatch) {
    const [, functionName, argsString] = functionMatch;

    // Parse arguments (can be references, numbers, or other formulas)
    const args: (Reference | string | number)[] = [];
    const argParts = splitArguments(argsString);

    for (const arg of argParts) {
      const trimmedArg = arg.trim();

      // Try to parse as reference
      const ref = parseReference(trimmedArg);
      if (ref) {
        args.push(ref);
        continue;
      }

      // Try to parse as number
      const num = parseFloat(trimmedArg);
      if (!isNaN(num)) {
        args.push(num);
        continue;
      }

      // Otherwise keep as string
      args.push(trimmedArg);
    }

    return {
      type: 'formula',
      function: functionName,
      args,
      references,
    };
  }

  // For now, treat everything else as a raw formula expression
  // (for expressions like A1+B2, A1*2, etc.)
  return {
    type: 'formula',
    value: normalized,
    references,
  };
}

/**
 * Splits function arguments by comma, respecting nested parentheses
 */
function splitArguments(argsString: string): string[] {
  const args: string[] = [];
  let currentArg = '';
  let depth = 0;

  for (let i = 0; i < argsString.length; i++) {
    const char = argsString[i];

    if (char === '(') {
      depth++;
      currentArg += char;
    } else if (char === ')') {
      depth--;
      currentArg += char;
    } else if (char === ',' && depth === 0) {
      args.push(currentArg.trim());
      currentArg = '';
    } else {
      currentArg += char;
    }
  }

  if (currentArg.trim()) {
    args.push(currentArg.trim());
  }

  return args;
}

/**
 * Converts a cell reference to grid coordinates (0-indexed)
 */
export function cellRefToCoords(ref: CellReference): { row: number; col: number } {
  return {
    row: ref.row - 1, // Formulas are 1-indexed, grid is 0-indexed
    col: columnToIndex(ref.column),
  };
}

/**
 * Converts grid coordinates to cell reference
 */
export function coordsToCellRef(row: number, col: number): CellReference {
  return {
    type: 'cell',
    column: indexToColumn(col),
    row: row + 1, // Grid is 0-indexed, formulas are 1-indexed
  };
}
