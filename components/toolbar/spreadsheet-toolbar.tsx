'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Download, Upload } from 'lucide-react';

interface SpreadsheetToolbarProps {
  scenario?: string;
  onScenarioChange?: (scenario: string) => void;
  onRefresh?: () => void;
}

export function SpreadsheetToolbar({
  scenario = 'base',
  onScenarioChange,
  onRefresh,
}: SpreadsheetToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Warehouse Spreadsheet</h1>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Scenario:</span>
          <Select value={scenario} onValueChange={onScenarioChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Base Case</SelectItem>
              <SelectItem value="optimistic">Optimistic</SelectItem>
              <SelectItem value="pessimistic">Pessimistic</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Import
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>
    </div>
  );
}
