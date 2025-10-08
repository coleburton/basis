"use client"

import { cn } from "@/lib/utils"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type PeriodGranularity = "month" | "quarter" | "year"

export function PeriodSelector() {
  const [granularity, setGranularity] = useState<PeriodGranularity>("quarter")
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(["2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"])

  const periods = {
    month: ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06"],
    quarter: ["2024-Q1", "2024-Q2", "2024-Q3", "2024-Q4"],
    year: ["2022", "2023", "2024", "2025"],
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-sans text-sm font-semibold text-foreground">Period Selection</h3>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Granularity Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between bg-transparent">
              <span className="capitalize">{granularity}</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Granularity</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setGranularity("month")}>Monthly</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGranularity("quarter")}>Quarterly</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setGranularity("year")}>Yearly</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Period List */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-2">
          {periods[granularity].map((period) => {
            const isSelected = selectedPeriods.includes(period)
            return (
              <button
                key={period}
                onClick={() => {
                  setSelectedPeriods((prev) => (isSelected ? prev.filter((p) => p !== period) : [...prev, period]))
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="font-mono">{period}</span>
                {isSelected && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                    Active
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <div className="text-xs text-muted-foreground">
          {selectedPeriods.length} period{selectedPeriods.length !== 1 ? "s" : ""} selected
        </div>
      </div>
    </div>
  )
}
