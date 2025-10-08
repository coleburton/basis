'use client';

import { DataEditor, GridCell, GridCellKind, GridColumn, Item } from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';
import { useCallback, useState } from 'react';

interface SpreadsheetGridProps {
  onCellEdited?: (col: number, row: number, newValue: string) => void;
}

export function SpreadsheetGrid({ onCellEdited }: SpreadsheetGridProps) {
  const [numRows, setNumRows] = useState(100);
  const [numCols, setNumCols] = useState(26);

  // Generate column headers (A, B, C, ... Z, AA, AB, ...)
  const getColumnName = (index: number): string => {
    let name = '';
    let num = index;
    while (num >= 0) {
      name = String.fromCharCode(65 + (num % 26)) + name;
      num = Math.floor(num / 26) - 1;
    }
    return name;
  };

  const columns: GridColumn[] = Array.from({ length: numCols }, (_, i) => ({
    title: getColumnName(i),
    id: `col-${i}`,
    width: 120,
  }));

  // Data storage (simple 2D array for now)
  const [data, setData] = useState<string[][]>(
    Array.from({ length: numRows }, () => Array(numCols).fill(''))
  );

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const cellData = data[row]?.[col] || '';

      return {
        kind: GridCellKind.Text,
        data: cellData,
        displayData: cellData,
        allowOverlay: true,
      };
    },
    [data]
  );

  const onCellsEdited = useCallback(
    (newValues: { location: Item; value: GridCell }[]) => {
      setData((prev) => {
        const newData = [...prev];

        for (const { location, value } of newValues) {
          const [col, row] = location;

          if (!newData[row]) {
            newData[row] = Array(numCols).fill('');
          }

          if (value.kind === GridCellKind.Text) {
            newData[row][col] = value.data;
            onCellEdited?.(col, row, value.data);
          }
        }

        return newData;
      });
    },
    [numCols, onCellEdited]
  );

  return (
    <div className="h-full w-full">
      <DataEditor
        getCellContent={getCellContent}
        columns={columns}
        rows={numRows}
        onCellEdited={(cell, newValue) => {
          onCellsEdited([{ location: cell, value: newValue }]);
        }}
        theme={{
          accentColor: '#3b82f6',
          accentLight: '#dbeafe',
          textDark: '#1f2937',
          textMedium: '#6b7280',
          textLight: '#9ca3af',
          textBubble: '#ffffff',
          bgIconHeader: '#f3f4f6',
          fgIconHeader: '#6b7280',
          textHeader: '#111827',
          textHeaderSelected: '#1f2937',
          bgCell: '#ffffff',
          bgCellMedium: '#f9fafb',
          bgHeader: '#f3f4f6',
          bgHeaderHasFocus: '#e5e7eb',
          bgHeaderHovered: '#e5e7eb',
          borderColor: '#e5e7eb',
          horizontalBorderColor: '#f3f4f6',
        }}
        smoothScrollX={true}
        smoothScrollY={true}
        rowMarkers="both"
        getCellsForSelection={true}
        rangeSelect="rect"
        columnSelect="multi"
        rowSelect="multi"
        keybindings={{
          selectAll: true,
          selectRow: true,
          selectColumn: true,
          downFill: true,
          rightFill: true,
        }}
        width="100%"
        height="100%"
      />
    </div>
  );
}
