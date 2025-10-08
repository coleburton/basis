"use client"

import { cn } from "@/lib/utils"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Plus, Table2, Clock, User, TrendingUp, DollarSign, ShoppingCart, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const models = [
  {
    name: "revenue",
    description: "Total revenue from all orders by period",
    icon: DollarSign,
    category: "Financial",
    author: "Sarah Chen",
    lastUpdated: "2 hours ago",
    usageCount: 24,
    color: "text-success",
  },
  {
    name: "expenses",
    description: "Operating expenses aggregated by period",
    icon: TrendingUp,
    category: "Financial",
    author: "Mike Johnson",
    lastUpdated: "1 day ago",
    usageCount: 18,
    color: "text-destructive",
  },
  {
    name: "gross_margin",
    description: "Calculated gross margin percentage",
    icon: TrendingUp,
    category: "Financial",
    author: "Sarah Chen",
    lastUpdated: "3 days ago",
    usageCount: 15,
    color: "text-primary",
  },
  {
    name: "customer_count",
    description: "Active customer count by period",
    icon: Users,
    category: "Customer",
    author: "Alex Kim",
    lastUpdated: "5 days ago",
    usageCount: 12,
    color: "text-warning",
  },
  {
    name: "order_volume",
    description: "Number of orders placed per period",
    icon: ShoppingCart,
    category: "Operations",
    author: "Mike Johnson",
    lastUpdated: "1 week ago",
    usageCount: 9,
    color: "text-primary",
  },
]

export function ModelCatalogView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedModel, setSelectedModel] = useState(models[0])

  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Table2 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-sans text-sm font-semibold text-foreground">Warehouse Sheets</span>
          </div>
          <div className="h-6 w-px bg-border" />
          <h2 className="font-sans text-sm font-medium text-foreground">Model Catalog</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a href="/">Home</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/sql-console">SQL Console</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/workbook">Workbook</a>
          </Button>
          <Button size="sm" className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            New Model
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Model List */}
        <div className="w-96 border-r border-border bg-card">
          {/* Search */}
          <div className="border-b border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="pl-9"
              />
            </div>
          </div>

          {/* Model Cards */}
          <div className="overflow-auto p-4">
            <div className="space-y-2">
              {filteredModels.map((model) => {
                const Icon = model.icon
                const isSelected = selectedModel.name === model.name
                return (
                  <button
                    key={model.name}
                    onClick={() => setSelectedModel(model)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent",
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn("rounded-md bg-muted p-1.5", model.color)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-mono text-sm font-medium text-foreground">{model.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {model.usageCount}
                      </Badge>
                    </div>
                    <p className="mb-2 text-xs text-muted-foreground">{model.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {model.category}
                      </Badge>
                      <span>•</span>
                      <span>{model.lastUpdated}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Model Detail */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="mb-2 flex items-center gap-3">
                  {(() => {
                    const Icon = selectedModel.icon
                    return (
                      <div className={cn("rounded-lg bg-muted p-2", selectedModel.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                    )
                  })()}
                  <h1 className="font-mono text-2xl font-bold text-foreground">{selectedModel.name}</h1>
                </div>
                <p className="text-muted-foreground">{selectedModel.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  Edit
                </Button>
                <Button size="sm">Use in Workbook</Button>
              </div>
            </div>

            <Tabs defaultValue="sql" className="space-y-4">
              <TabsList>
                <TabsTrigger value="sql">SQL Definition</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
                <TabsTrigger value="usage">Usage</TabsTrigger>
              </TabsList>

              <TabsContent value="sql" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">SQL Query</CardTitle>
                    <CardDescription>The SQL definition for this metric model</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <pre className="rounded-lg bg-muted p-4 font-mono text-sm text-foreground overflow-x-auto">
                      {`SELECT 
  date_trunc('quarter', order_date) as period,
  SUM(amount) as value
FROM raw.orders
WHERE order_date >= '2024-01-01'
  AND status = 'completed'
GROUP BY 1
ORDER BY 1`}
                    </pre>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Sample Output</CardTitle>
                    <CardDescription>Preview of the metric data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg border border-border">
                      <table className="w-full">
                        <thead className="border-b border-border bg-muted">
                          <tr>
                            <th className="px-4 py-2 text-left font-mono text-xs font-medium text-muted-foreground">
                              period
                            </th>
                            <th className="px-4 py-2 text-right font-mono text-xs font-medium text-muted-foreground">
                              value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { period: "2024-Q1", value: "1,250,000" },
                            { period: "2024-Q2", value: "1,380,000" },
                            { period: "2024-Q3", value: "1,520,000" },
                            { period: "2024-Q4", value: "1,680,000" },
                          ].map((row, idx) => (
                            <tr key={idx} className="border-b border-border last:border-0">
                              <td className="px-4 py-2 font-mono text-sm text-foreground">{row.period}</td>
                              <td className="px-4 py-2 text-right font-mono text-sm text-foreground">{row.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metadata" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Category</span>
                        <Badge variant="outline">{selectedModel.category}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Created by</span>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5" />
                          <span className="text-foreground">{selectedModel.author}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Last updated</span>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="text-foreground">{selectedModel.lastUpdated}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Usage count</span>
                        <span className="font-medium text-foreground">{selectedModel.usageCount} workbooks</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Period column</span>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">period</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Value column</span>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">value</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cache TTL</span>
                        <span className="text-foreground">1 hour</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Refresh schedule</span>
                        <span className="text-foreground">Every 6 hours</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="usage" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Workbooks Using This Model</CardTitle>
                    <CardDescription>{selectedModel.usageCount} workbooks reference this metric</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {[
                        "Q1 2024 Financial Model",
                        "Annual Budget Planning",
                        "Revenue Forecast 2024",
                        "Executive Dashboard",
                      ].map((workbook, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-lg border border-border p-3"
                        >
                          <span className="text-sm text-foreground">{workbook}</span>
                          <Button variant="ghost" size="sm">
                            Open
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
