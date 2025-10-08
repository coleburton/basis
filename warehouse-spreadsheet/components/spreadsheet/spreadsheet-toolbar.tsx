"use client"

import { Button } from "@/components/ui/button"
import {
  Save,
  Download,
  Upload,
  Undo,
  Redo,
  Copy,
  Scissors,
  ClipboardPaste,
  Table2,
  ChevronDown,
  RefreshCw,
  Settings,
  Database,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface SpreadsheetToolbarProps {
  onInsertMetric?: () => void
}

export function SpreadsheetToolbar({ onInsertMetric }: SpreadsheetToolbarProps) {
  return (
    <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* Left Section - Branding & Workbook Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
            <Table2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-sans text-sm font-semibold text-foreground">Warehouse Sheets</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <span className="font-medium">Q1 2024 Financial Model</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>Rename workbook</DropdownMenuItem>
            <DropdownMenuItem>Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center Section - Actions */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Redo className="h-4 w-4" />
        </Button>
        <div className="mx-2 h-6 w-px bg-border" />
        <Button variant="ghost" size="icon">
          <Scissors className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <ClipboardPaste className="h-4 w-4" />
        </Button>
        <div className="mx-2 h-6 w-px bg-border" />
        <Button variant="ghost" size="sm" className="gap-2" onClick={onInsertMetric}>
          <Database className="h-4 w-4" />
          Insert Metric
        </Button>
      </div>

      {/* Right Section - Status & Actions */}
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-success" />
          <span className="text-xs">Synced</span>
        </Badge>
        <Button variant="ghost" size="icon">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
        <div className="h-6 w-px bg-border" />
        <Button variant="ghost" size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <Button variant="ghost" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
        <Button size="sm" className="gap-2">
          <Save className="h-4 w-4" />
          Save
        </Button>
      </div>
    </div>
  )
}
