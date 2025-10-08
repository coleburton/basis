'use client';

import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface ResultsPanelProps {
  results?: {
    columns: string[];
    rows: Array<Record<string, unknown>>;
    totalRows: number;
    limited?: boolean;
  };
  error?: string;
  queryTime?: number;
}

export function ResultsPanel({ results, error, queryTime }: ResultsPanelProps) {
  if (error) {
    return (
      <div className="flex items-start gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-md">
        <XCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-destructive">Query Error</p>
          <p className="text-sm text-destructive/80 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        <p className="text-sm">Run a query to see results</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium">
            {results.totalRows} row{results.totalRows !== 1 ? 's' : ''}
          </span>
          {results.limited && (
            <span className="text-xs text-muted-foreground">
              (limited to {results.rows.length})
            </span>
          )}
        </div>
        {queryTime !== undefined && (
          <span className="text-xs text-muted-foreground">
            {queryTime}ms
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              {results.columns.map((col) => (
                <th
                  key={col}
                  className="px-4 py-2 text-left font-medium text-muted-foreground border-b"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.rows.map((row, i) => (
              <tr key={i} className="border-b hover:bg-muted/30">
                {results.columns.map((col) => (
                  <td key={col} className="px-4 py-2">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
