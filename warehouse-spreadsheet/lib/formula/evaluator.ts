/**
 * Formula Evaluator
 * Evaluates spreadsheet formulas with cell references and functions
 */

import {
  parseFormula,
  extractReferences,
  cellRefToCoords,
  type Reference,
  type CellReference,
  type RangeReference,
  type ParsedFormula,
} from './parser';

export type CellGetter = (row: number, col: number, sheetName?: string) => string | number | null;

/**
 * Evaluates a formula and returns the computed value
 */
export function evaluateFormula(
  formula: string,
  getCellValue: CellGetter
): string | number | null {
  // If it doesn't start with =, it's just a value
  if (!formula.startsWith('=')) {
    const num = parseFloat(formula);
    return isNaN(num) ? formula : num;
  }

  const parsed = parseFormula(formula);

  if (parsed.type === 'value') {
    return parsed.value ?? null;
  }

  // If it's a function call
  if (parsed.function) {
    return evaluateFunction(parsed.function, parsed.args || [], getCellValue);
  }

  // Otherwise, evaluate as expression
  if (parsed.value) {
    return evaluateExpression(parsed.value.toString(), getCellValue);
  }

  return null;
}

/**
 * Evaluates a spreadsheet function
 */
function evaluateFunction(
  functionName: string,
  args: (Reference | ParsedFormula | string | number)[],
  getCellValue: CellGetter
): string | number | null {
  const upperFn = functionName.toUpperCase();

  // Resolve all arguments to values
  const values = args.flatMap(arg => resolveArgument(arg, getCellValue));

  switch (upperFn) {
    case 'SUM':
      return sum(values);

    case 'AVERAGE':
    case 'AVG':
      return average(values);

    case 'COUNT':
      return count(values);

    case 'MIN':
      return min(values);

    case 'MAX':
      return max(values);

    case 'IF':
      return evaluateIf(args, getCellValue);

    default:
      console.warn(`Unknown function: ${functionName}`);
      return `#NAME?`;
  }
}

/**
 * Resolves an argument to an array of values
 */
function resolveArgument(
  arg: Reference | ParsedFormula | string | number,
  getCellValue: CellGetter
): (string | number | null)[] {
  // If it's a number, return as-is
  if (typeof arg === 'number') {
    return [arg];
  }

  // If it's a string, try to parse as number
  if (typeof arg === 'string') {
    const num = parseFloat(arg);
    return [isNaN(num) ? arg : num];
  }

  // If it's a reference
  if ('type' in arg && (arg.type === 'cell' || arg.type === 'range')) {
    return resolveCellOrRange(arg, getCellValue);
  }

  // If it's a parsed formula
  if ('type' in arg && arg.type === 'formula') {
    const result = evaluateFormula(`=${arg.value}`, getCellValue);
    return [result];
  }

  return [];
}

/**
 * Resolves a cell or range reference to values
 * Supports cross-sheet references via sheetName property
 */
function resolveCellOrRange(
  ref: Reference,
  getCellValue: CellGetter
): (string | number | null)[] {
  if (ref.type === 'cell') {
    const { row, col } = cellRefToCoords(ref);
    return [getCellValue(row, col, ref.sheetName)];
  }

  // It's a range
  const startCoords = cellRefToCoords(ref.start);
  const endCoords = cellRefToCoords(ref.end);

  const values: (string | number | null)[] = [];

  for (let row = startCoords.row; row <= endCoords.row; row++) {
    for (let col = startCoords.col; col <= endCoords.col; col++) {
      values.push(getCellValue(row, col, ref.sheetName));
    }
  }

  return values;
}

/**
 * Evaluates a simple expression like "A1+B2" or "A1*2"
 */
function evaluateExpression(
  expression: string,
  getCellValue: CellGetter
): string | number | null {
  try {
    // Extract all cell references and replace them with their values
    const references = extractReferences(expression);
    let evalExpression = expression;

    // Sort by length descending to replace longer references first (e.g., AA1 before A1)
    const sortedRefs = references.sort((a, b) => {
      const aStr = a.type === 'cell' ? `${a.column}${a.row}` : '';
      const bStr = b.type === 'cell' ? `${b.column}${b.row}` : '';
      return bStr.length - aStr.length;
    });

    for (const ref of sortedRefs) {
      if (ref.type === 'cell') {
        const { row, col } = cellRefToCoords(ref);
        const value = getCellValue(row, col, ref.sheetName);
        const numValue = typeof value === 'number' ? value : parseFloat(String(value || '0'));

        // Build the reference string (with or without sheet name)
        const refString = ref.sheetName
          ? `${ref.sheetName}!${ref.column}${ref.row}`
          : `${ref.column}${ref.row}`;

        // Escape special regex characters in sheet name if present
        const escapedRefString = refString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Replace all instances of this cell reference
        evalExpression = evalExpression.replace(
          new RegExp(escapedRefString, 'g'),
          isNaN(numValue) ? '0' : String(numValue)
        );
      }
    }

    // Evaluate the expression safely
    // WARNING: Using eval is dangerous in production. Consider using a safer expression parser.
    // For now, we'll use Function constructor which is slightly safer
    const result = new Function(`return ${evalExpression}`)();
    return typeof result === 'number' ? result : null;
  } catch (error) {
    console.error('Error evaluating expression:', error);
    return '#ERROR!';
  }
}

// Spreadsheet functions

function sum(values: (string | number | null)[]): number {
  return values.reduce((acc, val) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val || '0'));
    return acc + (isNaN(num) ? 0 : num);
  }, 0);
}

function average(values: (string | number | null)[]): number | null {
  const numbers = values
    .map(val => (typeof val === 'number' ? val : parseFloat(String(val || ''))))
    .filter(num => !isNaN(num));

  if (numbers.length === 0) return null;

  return sum(numbers) / numbers.length;
}

function count(values: (string | number | null)[]): number {
  return values.filter(val => val !== null && val !== '').length;
}

function min(values: (string | number | null)[]): number | null {
  const numbers = values
    .map(val => (typeof val === 'number' ? val : parseFloat(String(val || ''))))
    .filter(num => !isNaN(num));

  if (numbers.length === 0) return null;

  return Math.min(...numbers);
}

function max(values: (string | number | null)[]): number | null {
  const numbers = values
    .map(val => (typeof val === 'number' ? val : parseFloat(String(val || ''))))
    .filter(num => !isNaN(num));

  if (numbers.length === 0) return null;

  return Math.max(...numbers);
}

function evaluateIf(
  args: (Reference | ParsedFormula | string | number)[],
  getCellValue: CellGetter
): string | number | null {
  if (args.length < 2) return '#ERROR!';

  const condition = resolveArgument(args[0], getCellValue)[0];
  const trueValue = args[1] ? resolveArgument(args[1], getCellValue)[0] : null;
  const falseValue = args[2] ? resolveArgument(args[2], getCellValue)[0] : null;

  // Simple boolean evaluation
  const isTrue = Boolean(condition);

  return isTrue ? trueValue : falseValue;
}

/**
 * Gets all cell dependencies for a formula
 */
export function getFormulaDependencies(formula: string): { row: number; col: number }[] {
  if (!formula.startsWith('=')) return [];

  const references = extractReferences(formula);
  const dependencies: { row: number; col: number }[] = [];

  for (const ref of references) {
    if (ref.type === 'cell') {
      dependencies.push(cellRefToCoords(ref));
    } else {
      // For ranges, add all cells in the range
      const startCoords = cellRefToCoords(ref.start);
      const endCoords = cellRefToCoords(ref.end);

      for (let row = startCoords.row; row <= endCoords.row; row++) {
        for (let col = startCoords.col; col <= endCoords.col; col++) {
          dependencies.push({ row, col });
        }
      }
    }
  }

  return dependencies;
}

/**
 * Detects circular dependencies
 */
export function hasCircularDependency(
  row: number,
  col: number,
  formula: string,
  getCellFormula: (r: number, c: number) => string | null,
  visited = new Set<string>()
): boolean {
  const cellKey = `${row},${col}`;

  if (visited.has(cellKey)) {
    return true; // Circular dependency detected
  }

  visited.add(cellKey);

  const dependencies = getFormulaDependencies(formula);

  for (const dep of dependencies) {
    const depFormula = getCellFormula(dep.row, dep.col);
    if (depFormula && depFormula.startsWith('=')) {
      if (hasCircularDependency(dep.row, dep.col, depFormula, getCellFormula, new Set(visited))) {
        return true;
      }
    }
  }

  return false;
}
