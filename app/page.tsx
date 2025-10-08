'use client';

import { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SpreadsheetGrid } from '@/components/grid/spreadsheet-grid';
import { SqlConsole } from '@/components/sql-console/sql-console';
import { ResultsPanel } from '@/components/sql-console/results-panel';
import { SpreadsheetToolbar } from '@/components/toolbar/spreadsheet-toolbar';

export default function Home() {
  const [scenario, setScenario] = useState('base');
  const [sqlResults, setSqlResults] = useState<{
    columns: string[];
    rows: Array<Record<string, unknown>>;
    totalRows: number;
    limited?: boolean;
  } | null>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [queryTime, setQueryTime] = useState<number | undefined>();

  const handleExecuteQuery = async (sql: string) => {
    setSqlError(null);
    setSqlResults(null);

    try {
      const startTime = Date.now();
      const response = await fetch('/api/sql/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSqlError(data.error || 'Query failed');
        return;
      }

      setQueryTime(Date.now() - startTime);
      setSqlResults({
        columns: data.columns,
        rows: data.rows,
        totalRows: data.total_rows,
        limited: data.limited,
      });
    } catch (error) {
      setSqlError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleRefresh = () => {
    console.log('Refreshing data...');
    // TODO: Implement refresh logic
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <SpreadsheetToolbar
        scenario={scenario}
        onScenarioChange={setScenario}
        onRefresh={handleRefresh}
      />

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical">
          {/* Top: Spreadsheet Grid */}
          <Panel defaultSize={60} minSize={30}>
            <SpreadsheetGrid
              onCellEdited={(col, row, value) => {
                console.log(`Cell edited: [${col}, ${row}] = ${value}`);
              }}
            />
          </Panel>

          <PanelResizeHandle className="h-1 bg-border hover:bg-primary/20 transition-colors" />

          {/* Bottom: SQL Console */}
          <Panel defaultSize={40} minSize={20}>
            <PanelGroup direction="horizontal">
              {/* Left: SQL Editor */}
              <Panel defaultSize={50} minSize={30}>
                <SqlConsole onExecute={handleExecuteQuery} />
              </Panel>

              <PanelResizeHandle className="w-1 bg-border hover:bg-primary/20 transition-colors" />

              {/* Right: Results */}
              <Panel defaultSize={50} minSize={30}>
                <div className="h-full border-t bg-background">
                  <div className="flex items-center px-4 py-2 border-b bg-muted/40">
                    <span className="text-sm font-medium">Results</span>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    <ResultsPanel
                      results={sqlResults || undefined}
                      error={sqlError || undefined}
                      queryTime={queryTime}
                    />
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
