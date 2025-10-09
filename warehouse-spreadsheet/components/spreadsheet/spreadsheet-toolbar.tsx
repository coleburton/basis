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
  ArrowLeft,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Percent,
  DollarSign,
  Hash,
  Calendar,
} from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

interface CellFormat {
  bold?: boolean
  italic?: boolean
  underline?: boolean
  align?: 'left' | 'center' | 'right'
  numberFormat?: 'general' | 'currency' | 'percentage' | 'text' | 'date'
}

type NumberFormatOption = NonNullable<CellFormat['numberFormat']>

interface SpreadsheetToolbarProps {
  onInsertMetric?: () => void
  onBold?: () => void
  onItalic?: () => void
  onUnderline?: () => void
  onAlign?: (align: 'left' | 'center' | 'right') => void
  onNumberFormat?: (format: 'general' | 'currency' | 'percentage' | 'text' | 'date') => void
  currentFormat?: CellFormat | null
}

export function SpreadsheetToolbar({
  onInsertMetric,
  onBold,
  onItalic,
  onUnderline,
  onAlign,
  onNumberFormat,
  currentFormat
}: SpreadsheetToolbarProps) {
  const numberFormat = currentFormat?.numberFormat ?? 'general'
  const numberFormatLabels: Record<NumberFormatOption, string> = {
    general: 'Number',
    currency: 'Currency',
    percentage: 'Percentage',
    text: 'Plain Text',
    date: 'Date',
  }

  return (
    <div className="border-b border-border bg-card">
      {/* Main Toolbar */}
      <div className="flex h-14 items-center justify-between px-4">
      {/* Left Section - Branding & Workbook Name */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild className="h-7 w-7">
            <Link href="/workbooks">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
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

      {/* Formatting Toolbar */}
      <div className="flex h-11 items-center gap-1 border-t border-border px-4">
        {/* Text Formatting */}
        <Button
          variant={currentFormat?.bold ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={onBold}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          variant={currentFormat?.italic ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={onItalic}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          variant={currentFormat?.underline ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={onUnderline}
        >
          <Underline className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Alignment */}
        <Button
          variant={currentFormat?.align === 'left' ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onAlign?.('left')}
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          variant={currentFormat?.align === 'center' ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onAlign?.('center')}
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          variant={currentFormat?.align === 'right' ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onAlign?.('right')}
        >
          <AlignRight className="h-4 w-4" />
        </Button>

        <div className="mx-1 h-6 w-px bg-border" />

        {/* Number Formatting */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5">
              <Hash className="h-4 w-4" />
              <span className="text-xs inline-block w-16 text-left">
                {numberFormatLabels[numberFormat]}
              </span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onNumberFormat?.('general')}>
              <Hash className="mr-2 h-4 w-4" />
              Number
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNumberFormat?.('currency')}>
              <DollarSign className="mr-2 h-4 w-4" />
              Currency
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNumberFormat?.('percentage')}>
              <Percent className="mr-2 h-4 w-4" />
              Percentage
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onNumberFormat?.('date')}>
              <Calendar className="mr-2 h-4 w-4" />
              Date
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onNumberFormat?.('text')}>Plain Text</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant={numberFormat === 'currency' ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onNumberFormat?.('currency')}
        >
          <DollarSign className="h-4 w-4" />
        </Button>
        <Button
          variant={numberFormat === 'percentage' ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onNumberFormat?.('percentage')}
        >
          <Percent className="h-4 w-4" />
        </Button>
        <Button
          variant={numberFormat === 'date' ? "default" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => onNumberFormat?.('date')}
        >
          <Calendar className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
