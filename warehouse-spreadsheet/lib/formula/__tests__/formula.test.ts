/**
 * Formula Parser and Evaluator Tests
 *
 * Run these tests manually or add them to your test suite.
 * These demonstrate the key formula features.
 */

import {
  parseCellReference,
  parseRangeReference,
  extractReferences,
  parseFormula,
  columnToIndex,
  indexToColumn,
  cellRefToCoords,
  coordsToCellRef,
} from '../parser';

import { evaluateFormula, getFormulaDependencies } from '../evaluator';

// Test cell reference parsing
console.log('=== Cell Reference Tests ===');
console.log('parseCellReference("A1"):', parseCellReference('A1'));
console.log('parseCellReference("AA100"):', parseCellReference('AA100'));
console.log('parseCellReference("Z26"):', parseCellReference('Z26'));

// Test range reference parsing
console.log('\n=== Range Reference Tests ===');
console.log('parseRangeReference("A1:C100"):', parseRangeReference('A1:C100'));
console.log('parseRangeReference("B2:D5"):', parseRangeReference('B2:D5'));

// Test column conversion
console.log('\n=== Column Conversion Tests ===');
console.log('columnToIndex("A"):', columnToIndex('A')); // Should be 0
console.log('columnToIndex("Z"):', columnToIndex('Z')); // Should be 25
console.log('columnToIndex("AA"):', columnToIndex('AA')); // Should be 26
console.log('indexToColumn(0):', indexToColumn(0)); // Should be "A"
console.log('indexToColumn(25):', indexToColumn(25)); // Should be "Z"
console.log('indexToColumn(26):', indexToColumn(26)); // Should be "AA"

// Test extracting references from formulas
console.log('\n=== Extract References Tests ===');
console.log('extractReferences("=SUM(A1:C10)"):', extractReferences('=SUM(A1:C10)'));
console.log('extractReferences("=A1+B2+C3"):', extractReferences('=A1+B2+C3'));
console.log('extractReferences("=AVERAGE(A1,B1,C1)"):', extractReferences('=AVERAGE(A1,B1,C1)'));

// Test formula parsing
console.log('\n=== Formula Parsing Tests ===');
console.log('parseFormula("=SUM(A1:C10)"):', JSON.stringify(parseFormula('=SUM(A1:C10)'), null, 2));
console.log('parseFormula("=A1+B2"):', JSON.stringify(parseFormula('=A1+B2'), null, 2));
console.log('parseFormula("=AVERAGE(A1,B1,C1)"):', JSON.stringify(parseFormula('=AVERAGE(A1,B1,C1)'), null, 2));

// Test formula evaluation with sample data
console.log('\n=== Formula Evaluation Tests ===');

// Sample grid data
const sampleGrid: Record<string, number> = {
  'A1': 10,
  'A2': 20,
  'A3': 30,
  'B1': 5,
  'B2': 15,
  'B3': 25,
  'C1': 100,
  'C2': 200,
  'C3': 300,
};

const getCellValue = (row: number, col: number): string | number | null => {
  const ref = coordsToCellRef(row, col);
  const key = `${ref.column}${ref.row}`;
  return sampleGrid[key] ?? null;
};

console.log('Sample grid:', sampleGrid);
console.log('Evaluate "=SUM(A1:A3)":', evaluateFormula('=SUM(A1:A3)', getCellValue)); // Should be 60
console.log('Evaluate "=AVERAGE(A1:A3)":', evaluateFormula('=AVERAGE(A1:A3)', getCellValue)); // Should be 20
console.log('Evaluate "=A1+B1":', evaluateFormula('=A1+B1', getCellValue)); // Should be 15
console.log('Evaluate "=A1*2":', evaluateFormula('=A1*2', getCellValue)); // Should be 20
console.log('Evaluate "=MAX(A1:B3)":', evaluateFormula('=MAX(A1:B3)', getCellValue)); // Should be 30
console.log('Evaluate "=MIN(A1:B3)":', evaluateFormula('=MIN(A1:B3)', getCellValue)); // Should be 5
console.log('Evaluate "=COUNT(A1:C3)":', evaluateFormula('=COUNT(A1:C3)', getCellValue)); // Should be 9

// Test dependencies
console.log('\n=== Dependency Tests ===');
console.log('getFormulaDependencies("=SUM(A1:A3)"):', getFormulaDependencies('=SUM(A1:A3)'));
console.log('getFormulaDependencies("=A1+B2+C3"):', getFormulaDependencies('=A1+B2+C3'));

console.log('\n=== All Tests Complete ===');
