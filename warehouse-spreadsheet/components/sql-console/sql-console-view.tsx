"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Play, Save, Database, Table2, Clock, AlertCircle } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function SQLConsoleView() {
  const [modelName, setModelName] = useState("revenue")
  const [sqlQuery, setSqlQuery] = useState(`SELECT 
  date_trunc('quarter', order_date) as period,
  SUM(amount) as value
FROM raw.orders
WHERE order_date >= '2024-01-01'
GROUP BY 1
ORDER BY 1`)

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
          <h2 className="font-sans text-sm font-medium text-foreground">SQL Console</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a href="/">Home</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/models">Model Catalog</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/workbook">Workbook</a>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Editor Area */}
        <div className="flex flex-1 flex-col">
          {/* Model Configuration */}
          <div className="border-b border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Model Name</label>
                <Input
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="e.g., revenue, expenses, gross_margin"
                  className="font-mono"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Period Column</label>
                <Input value="period" disabled className="font-mono bg-muted" />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Value Column</label>
                <Input value="value" disabled className="font-mono bg-muted" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-2">
                <Play className="h-3.5 w-3.5" />
                Run Query
              </Button>
              <Button size="sm" variant="outline" className="gap-2 bg-transparent">
                <Save className="h-3.5 w-3.5" />
                Save Model
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <Database className="h-3 w-3" />
                  <span className="text-xs">Snowflake</span>
                </Badge>
                <Badge variant="outline" className="gap-1.5">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">Timeout: 30s</span>
                </Badge>
              </div>
            </div>
          </div>

          {/* SQL Editor */}
          <div className="flex-1 overflow-hidden">
            <Tabs defaultValue="editor" className="flex h-full flex-col">
              <div className="border-b border-border bg-card px-4">
                <TabsList className="h-10">
                  <TabsTrigger value="editor">SQL Editor</TabsTrigger>
                  <TabsTrigger value="results">Results</TabsTrigger>
                  <TabsTrigger value="schema">Schema</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="editor" className="flex-1 overflow-auto p-0 m-0">
                <div className="h-full">
                  <textarea
                    value={sqlQuery}
                    onChange={(e) => setSqlQuery(e.target.value)}
                    className="h-full w-full resize-none bg-card p-4 font-mono text-sm text-foreground focus:outline-none"
                    spellCheck={false}
                  />
                </div>
              </TabsContent>

              <TabsContent value="results" className="flex-1 overflow-auto p-4 m-0">
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
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Query executed in 1.2s • 4 rows returned
                </div>
              </TabsContent>

              <TabsContent value="schema" className="flex-1 overflow-auto p-4 m-0">
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-mono">raw.orders</CardTitle>
                      <CardDescription className="text-xs">Source table for order data</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {["order_id", "order_date", "customer_id", "amount", "status"].map((col) => (
                          <div key={col} className="flex items-center gap-2 text-xs">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            <span className="font-mono text-foreground">{col}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-mono">raw.customers</CardTitle>
                      <CardDescription className="text-xs">Customer dimension table</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1.5">
                        {["customer_id", "name", "email", "created_at", "segment"].map((col) => (
                          <div key={col} className="flex items-center gap-2 text-xs">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            <span className="font-mono text-foreground">{col}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Right Sidebar - Guidelines */}
        <div className="w-80 border-l border-border bg-card p-4 overflow-auto">
          <h3 className="mb-3 font-sans text-sm font-semibold text-foreground">Model Guidelines</h3>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Required Columns</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div>
                  <span className="font-mono text-foreground">period</span> - Date/timestamp column
                </div>
                <div>
                  <span className="font-mono text-foreground">value</span> - Numeric metric value
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Allowed Statements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                <Badge variant="outline" className="font-mono text-xs">
                  SELECT
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  FROM
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  WHERE
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  GROUP BY
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  ORDER BY
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <CardTitle className="text-sm">Restrictions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                <div>• No INSERT, UPDATE, DELETE</div>
                <div>• No CREATE, DROP, ALTER</div>
                <div>• 30 second timeout</div>
                <div>• Read-only sandbox schema</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Example Query</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="rounded-md bg-muted p-2 font-mono text-xs text-foreground overflow-x-auto">
                  {`SELECT 
  date_trunc('month', date) as period,
  SUM(amount) as value
FROM raw.transactions
WHERE date >= '2024-01-01'
GROUP BY 1
ORDER BY 1`}
                </pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
