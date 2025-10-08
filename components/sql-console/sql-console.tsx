'use client';

import { useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Play, Loader2 } from 'lucide-react';

interface SqlConsoleProps {
  onExecute?: (sql: string) => Promise<void>;
}

export function SqlConsole({ onExecute }: SqlConsoleProps) {
  const [sql, setSql] = useState('SELECT * FROM your_table LIMIT 10');
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    if (!sql.trim() || isExecuting) return;

    setIsExecuting(true);
    try {
      await onExecute?.(sql);
    } catch (error) {
      console.error('Execution error:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // Cmd/Ctrl + Enter to execute
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  return (
    <div className="flex flex-col h-full border-t bg-background">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">SQL Console</span>
          <span className="text-xs text-muted-foreground">
            (Read-only: SELECT, SHOW, DESCRIBE)
          </span>
        </div>
        <Button
          onClick={handleExecute}
          disabled={isExecuting || !sql.trim()}
          size="sm"
          className="gap-2"
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Query
            </>
          )}
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={sql}
          onChange={(value) => setSql(value || '')}
          theme="vs-light"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
          onMount={(editor, monaco) => {
            editor.addCommand(
              monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
              handleExecute
            );
          }}
        />
      </div>
    </div>
  );
}
