"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Search, Database, Calendar, Filter, ChevronRight, Check } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface InsertMetricDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Sample models data
const SAMPLE_MODELS = [
  {
    id: "revenue",
    name: "Revenue",
    description: "Total revenue by product and region",
    dimensions: ["product", "region", "channel"],
    granularity: ["month", "quarter", "year"],
    lastRefresh: "2 hours ago",
  },
  {
    id: "expenses",
    name: "Operating Expenses",
    description: "Operating expenses by department",
    dimensions: ["department", "expense_type"],
    granularity: ["month", "quarter", "year"],
    lastRefresh: "1 hour ago",
  },
  {
    id: "headcount",
    name: "Headcount",
    description: "Employee headcount by department and level",
    dimensions: ["department", "level", "location"],
    granularity: ["month", "quarter"],
    lastRefresh: "3 hours ago",
  },
  {
    id: "arr",
    name: "Annual Recurring Revenue",
    description: "ARR by customer segment",
    dimensions: ["segment", "plan_type"],
    granularity: ["month", "quarter", "year"],
    lastRefresh: "30 minutes ago",
  },
]

const DIMENSION_VALUES = {
  product: ["SaaS Platform", "Enterprise", "API Access", "Professional Services"],
  region: ["North America", "EMEA", "APAC", "LATAM"],
  channel: ["Direct", "Partner", "Online"],
  department: ["Engineering", "Sales", "Marketing", "G&A"],
  expense_type: ["Salaries", "Cloud Infrastructure", "Marketing", "Office"],
  level: ["IC", "Manager", "Director", "VP+"],
  location: ["San Francisco", "New York", "London", "Remote"],
  segment: ["Enterprise", "Mid-Market", "SMB"],
  plan_type: ["Annual", "Monthly"],
}

type DimensionMode = "select" | "total" | "pivot"

interface DimensionConfig {
  mode: DimensionMode
  values: string[]
}

export function InsertMetricDialog({ open, onOpenChange }: InsertMetricDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [dimensionConfigs, setDimensionConfigs] = useState<Record<string, DimensionConfig>>({})
  const [selectedPeriod, setSelectedPeriod] = useState("month")

  const filteredModels = SAMPLE_MODELS.filter(
    (model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const currentModel = SAMPLE_MODELS.find((m) => m.id === selectedModel)

  const setDimensionMode = (dimension: string, mode: DimensionMode) => {
    setDimensionConfigs((prev) => {
      const current = prev[dimension]

      // If clicking the same mode that's already active, unconfigure the dimension
      if (current?.mode === mode) {
        const newConfigs = { ...prev }
        delete newConfigs[dimension]
        return newConfigs
      }

      // Otherwise, set the new mode
      return {
        ...prev,
        [dimension]: {
          mode,
          values: mode === "select" ? current?.values || [] : [],
        },
      }
    })
  }

  const toggleDimensionValue = (dimension: string, value: string) => {
    setDimensionConfigs((prev) => {
      const current = prev[dimension] || { mode: "select", values: [] }
      const isSelected = current.values.includes(value)
      const newValues = isSelected ? current.values.filter((v) => v !== value) : [...current.values, value]

      return {
        ...prev,
        [dimension]: {
          ...current,
          values: newValues,
        },
      }
    })
  }

  const handleInsert = () => {
    // This would insert the metric formula into the active cell
    console.log("[v0] Inserting metric:", {
      model: selectedModel,
      dimensions: dimensionConfigs,
      period: selectedPeriod,
    })
    onOpenChange(false)
  }

  const generatePreviewFormula = () => {
    if (!currentModel) return ""

    const dimensionParams: string[] = []
    currentModel.dimensions.forEach((dim) => {
      const config = dimensionConfigs[dim]

      if (config) {
        if (config.mode === "total") {
          dimensionParams.push(`"${dim}": "ALL"`)
        } else if (config.mode === "pivot") {
          dimensionParams.push(`"${dim}": "PIVOT"`)
        } else if (config.values.length > 0) {
          dimensionParams.push(`"${dim}": [${config.values.map((v) => `"${v}"`).join(", ")}]`)
        }
      }
    })

    const paramsStr = dimensionParams.length > 0 ? `, {${dimensionParams.join(", ")}}` : ""
    return `=METRICRANGE("${currentModel.id}", A2:A13${paramsStr})`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Insert Metric from Warehouse</DialogTitle>
          <DialogDescription>
            Select a metric model and configure dimensions to insert data into your spreadsheet
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 gap-6 overflow-hidden">
          <div className="flex w-80 flex-col gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {filteredModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`w-full rounded-md border p-3 text-left transition-colors ${
                    selectedModel === model.id ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">{model.name}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{model.description}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {model.dimensions.slice(0, 2).map((dim) => (
                          <Badge key={dim} variant="outline" className="text-xs">
                            {dim}
                          </Badge>
                        ))}
                        {model.dimensions.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{model.dimensions.length - 2}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {selectedModel === model.id && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-hidden">
            {currentModel ? (
              <>
                <div className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-base">{currentModel.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{currentModel.description}</p>
                    </div>
                    <Badge variant="outline" className="gap-1.5">
                      <div className="h-1.5 w-1.5 rounded-full bg-success" />
                      {currentModel.lastRefresh}
                    </Badge>
                  </div>
                </div>

                <Tabs defaultValue="dimensions" className="flex-1 flex flex-col overflow-hidden">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="dimensions" className="gap-2">
                      <Filter className="h-4 w-4" />
                      Dimensions
                    </TabsTrigger>
                    <TabsTrigger value="time" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      Time Period
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="dimensions" className="flex-1 overflow-y-auto mt-4 space-y-4">
                    <div className="space-y-6">
                      {currentModel.dimensions.map((dimension) => {
                        const config = dimensionConfigs[dimension]
                        const isConfigured = config !== undefined

                        return (
                          <div
                            key={dimension}
                            className={`space-y-3 pb-4 border-b border-border last:border-0 transition-opacity ${
                              !isConfigured ? "opacity-40" : "opacity-100"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium capitalize">{dimension.replace("_", " ")}</Label>
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant={config?.mode === "select" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setDimensionMode(dimension, "select")}
                                className="text-xs"
                              >
                                Select Values
                              </Button>
                              <Button
                                variant={config?.mode === "total" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setDimensionMode(dimension, "total")}
                                className="text-xs"
                              >
                                Total (No Breakdown)
                              </Button>
                              <Button
                                variant={config?.mode === "pivot" ? "default" : "outline"}
                                size="sm"
                                onClick={() => setDimensionMode(dimension, "pivot")}
                                className="text-xs"
                              >
                                Pivot All Values
                              </Button>
                            </div>

                            {config?.mode === "select" && (
                              <div className="flex flex-wrap gap-2">
                                {(DIMENSION_VALUES[dimension as keyof typeof DIMENSION_VALUES] || []).map((value) => {
                                  const isSelected = config.values.includes(value)
                                  return (
                                    <Button
                                      key={value}
                                      variant={isSelected ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => toggleDimensionValue(dimension, value)}
                                      className="gap-2"
                                    >
                                      {isSelected && <Check className="h-3 w-3" />}
                                      {value}
                                    </Button>
                                  )
                                })}
                              </div>
                            )}

                            {config?.mode === "total" && (
                              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                                All {dimension.replace("_", " ")} values will be aggregated into a single total without
                                breakdown
                              </div>
                            )}

                            {config?.mode === "pivot" && (
                              <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                                Each {dimension.replace("_", " ")} value will be expanded as a separate column in your
                                spreadsheet
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </TabsContent>

                  <TabsContent value="time" className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Time Granularity</Label>
                      <p className="text-sm text-muted-foreground">
                        Select the time period granularity for this metric. This will align with your spreadsheet's
                        period selector.
                      </p>
                      <div className="flex gap-2 mt-3">
                        {currentModel.granularity.map((period) => (
                          <Button
                            key={period}
                            variant={selectedPeriod === period ? "default" : "outline"}
                            onClick={() => setSelectedPeriod(period)}
                            className="capitalize"
                          >
                            {period}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Database className="h-4 w-4 text-primary" />
                        Preview Formula
                      </div>
                      <code className="block rounded bg-background p-3 text-xs font-mono break-all">
                        {generatePreviewFormula()}
                      </code>
                      <p className="text-xs text-muted-foreground">
                        This formula will insert {selectedPeriod}ly data for the configured dimensions
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center">
                <div className="space-y-2">
                  <Database className="h-12 w-12 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Select a model from the left to configure dimensions</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            {currentModel
              ? `${Object.keys(dimensionConfigs).length} of ${currentModel.dimensions.length} dimensions configured`
              : "No model selected"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsert} disabled={!currentModel} className="gap-2">
              Insert Metric
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
