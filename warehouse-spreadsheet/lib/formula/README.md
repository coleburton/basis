# Formula System

This directory contains the formula parsing and evaluation system for the warehouse spreadsheet.

## Features

### Cell References
- **Single cells**: `A1`, `B2`, `AA100`
- **Ranges**: `A1:C100`, `B2:D5`

### Supported Functions
- `SUM(range)` - Sum of all values in range
- `AVERAGE(range)` - Average of all values
- `COUNT(range)` - Count of non-empty cells
- `MIN(range)` - Minimum value
- `MAX(range)` - Maximum value
- `IF(condition, trueValue, falseValue)` - Conditional logic

### Arithmetic Expressions
- `=A1+B2` - Addition
- `=A1-B2` - Subtraction
- `=A1*B2` - Multiplication
- `=A1/B2` - Division
- `=A1*2` - Operations with constants

## Usage Example

```typescript
import { evaluateFormula } from '@/lib/formula/evaluator';

// Define a function to get cell values
const getCellValue = (row: number, col: number): string | number | null => {
  // Your logic to retrieve cell values
  return gridData[row]?.[col] ?? null;
};

// Evaluate a formula
const result = evaluateFormula('=SUM(A1:C10)', getCellValue);
console.log(result); // Returns the sum of cells A1 through C10
```

## Architecture

### Parser (`parser.ts`)
- Parses cell references (A1, B2, etc.)
- Parses range references (A1:C10)
- Extracts dependencies from formulas
- Converts between column letters and indices

### Evaluator (`evaluator.ts`)
- Evaluates formulas with cell references
- Implements spreadsheet functions
- Resolves cell and range references
- Detects circular dependencies

## Testing

Run the test file to verify functionality:

```bash
npx tsx lib/formula/__tests__/formula.test.ts
```

## Implementation in Components

The formula system is integrated into the `SpreadsheetGrid` component:

1. When a user enters a formula (starting with `=`), it's stored as the raw value
2. The evaluator computes the result using the current grid data
3. The computed value is displayed in the cell
4. The raw formula is shown in the formula bar when the cell is selected
5. When source cells change, dependent formulas are automatically recalculated

## Future Enhancements

- [ ] More functions (SUMIF, COUNTIF, VLOOKUP, etc.)
- [ ] Better error messages
- [ ] Formula auto-complete
- [ ] Cell reference highlighting
- [ ] Performance optimization for large grids
- [ ] Safer expression evaluation (replace Function constructor)
