"use client"

import { useState } from "react"
import { useWorkbook } from "@/lib/workbook/workbook-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SheetTabsProps {
  className?: string
}

export function SheetTabs({ className }: SheetTabsProps) {
  const { sheets, activeSheetId, addSheet, deleteSheet, renameSheet, setActiveSheet } = useWorkbook()
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")

  const handleAddSheet = () => {
    const newSheetId = addSheet()
    setActiveSheet(newSheetId)
  }

  const handleStartRename = (sheetId: string, currentName: string) => {
    setEditingSheetId(sheetId)
    setEditingName(currentName)
  }

  const handleFinishRename = () => {
    if (editingSheetId && editingName.trim()) {
      renameSheet(editingSheetId, editingName.trim())
    }
    setEditingSheetId(null)
    setEditingName("")
  }

  const handleCancelRename = () => {
    setEditingSheetId(null)
    setEditingName("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishRename()
    } else if (e.key === "Escape") {
      handleCancelRename()
    }
  }

  return (
    <div className={cn("flex items-center gap-1 border-t border-border bg-muted/30 px-2 py-1.5", className)}>
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        {sheets.map((sheet) => (
          <div
            key={sheet.id}
            className={cn(
              "group relative flex items-center gap-1 rounded-t px-3 py-1.5 text-sm transition-colors",
              activeSheetId === sheet.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {editingSheetId === sheet.id ? (
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={handleFinishRename}
                onKeyDown={handleKeyDown}
                className="h-6 w-24 px-2 py-0 text-sm"
                autoFocus
              />
            ) : (
              <>
                <button
                  onClick={() => setActiveSheet(sheet.id)}
                  className="flex-1 cursor-pointer text-left font-medium"
                >
                  {sheet.name}
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-5 w-5 opacity-0 transition-opacity group-hover:opacity-100",
                        activeSheetId === sheet.id && "opacity-100"
                      )}
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => handleStartRename(sheet.id, sheet.name)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    {sheets.length > 1 && (
                      <DropdownMenuItem
                        onClick={() => deleteSheet(sheet.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleAddSheet}
        className="h-7 w-7 shrink-0"
        title="Add sheet"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
