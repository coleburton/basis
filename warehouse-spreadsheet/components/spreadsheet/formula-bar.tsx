"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Check, X } from "lucide-react"
import { KeyboardEvent } from "react"

interface FormulaBarProps {
  activeCell: { row: number; col: number }
  formula: string
  onFormulaChange: (formula: string) => void
  onFormulaCommit?: () => void
  onFormulaCancel?: () => void
  onFormulaFocus?: () => void
  onFormulaToggleAnchor?: () => void
}

export function FormulaBar({
  activeCell,
  formula,
  onFormulaChange,
  onFormulaCommit,
  onFormulaCancel,
  onFormulaFocus,
  onFormulaToggleAnchor
}: FormulaBarProps) {
  const cellRef = `${String.fromCharCode(65 + activeCell.col)}${activeCell.row + 1}`

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      onFormulaCommit?.()
    } else if (event.key === "Escape") {
      event.preventDefault()
      onFormulaCancel?.()
    } else if (event.key === "F4") {
      event.preventDefault()
      onFormulaToggleAnchor?.()
    }
  }

  return (
    <div className="flex h-12 items-center gap-2 border-b border-border bg-card px-4">
      {/* Cell Reference */}
      <div className="flex h-8 w-20 items-center justify-center rounded-md border border-border bg-muted">
        <span className="font-mono text-sm font-medium text-foreground">{cellRef}</span>
      </div>

      {/* Formula Input Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFormulaCancel}>
          <X className="h-4 w-4 text-destructive" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFormulaCommit}>
          <Check className="h-4 w-4 text-success" />
        </Button>
      </div>

      {/* Formula Input */}
      <div className="flex-1">
        <Input
          value={formula}
          onChange={(e) => onFormulaChange(e.target.value)}
          onFocus={onFormulaFocus}
          onKeyDown={handleKeyDown}
          className="h-8 border-0 bg-transparent font-mono text-sm focus-visible:ring-0"
          placeholder="Enter formula or value..."
        />
      </div>
    </div>
  )
}
