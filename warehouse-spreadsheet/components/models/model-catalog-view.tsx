"use client"

import { cn } from "@/lib/utils"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Plus, Table2, RefreshCw, Database, Pencil } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CreateModelDialog } from "./create-model-dialog"

interface Model {
  id: string;
  name: string;
  description: string;
  database: string;
  schema: string;
  type: string;
  sql_definition?: string;
  primary_date_column?: string;
  date_grain?: string;
  dimension_columns: string[];
  measure_columns: string[];
  refresh_schedule?: string;
  last_refresh_at?: string;
  materialized_rows: number;
  date_range?: { min: string; max: string } | null;
}

export function ModelCatalogView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [models, setModels] = useState<Model[]>([])
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Model | null>(null)

  // Load models from API
  useEffect(() => {
    loadModels()
  }, [])

  const loadModels = async () => {
    try {
      setLoading(true)
      console.log('[Model Catalog] Loading models...')
      const response = await fetch('/api/catalog')
      const data = await response.json()
      console.log('[Model Catalog] Loaded models:', data.catalog)
      setModels(data.catalog || [])
      
      // If we had a selected model, find it in the new data and update it
      if (selectedModel) {
        const updatedSelectedModel = data.catalog?.find((m: Model) => m.id === selectedModel.id)
        if (updatedSelectedModel) {
          console.log('[Model Catalog] Updating selected model:', updatedSelectedModel)
          setSelectedModel(updatedSelectedModel)
        }
      } else if (data.catalog && data.catalog.length > 0) {
        setSelectedModel(data.catalog[0])
      }
    } catch (error) {
      console.error('[Model Catalog] Failed to load models:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshModel = async (modelId: string) => {
    try {
      setRefreshing(modelId)
      const response = await fetch('/api/models/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Refresh failed')
      }

      const result = await response.json()
      
      // Poll for job completion
      const jobId = result.jobId
      const jobStatus = await pollJobStatus(jobId)
      
      // Reload models to get updated stats
      await loadModels()
      
      // Show success message
      alert(`Model refreshed successfully! Processed ${jobStatus.rows_processed || 0} rows.`)
    } catch (error) {
      console.error('Failed to refresh model:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to refresh model:\n\n${errorMessage}\n\nCheck the browser console for more details.`)
    } finally {
      setRefreshing(null)
    }
  }

  const pollJobStatus = async (jobId: string) => {
    let attempts = 0
    const maxAttempts = 120 // 2 minute max (Snowflake queries can take time)
    
    console.log(`Polling job status for: ${jobId}`)
    
    while (attempts < maxAttempts) {
      const response = await fetch(`/api/jobs/${jobId}`)
      const status = await response.json()
      
      console.log(`Job ${jobId} status:`, status.status, status.rows_processed ? `(${status.rows_processed} rows)` : '')
      
      if (status.status === 'success') {
        return status
      } else if (status.status === 'error') {
        const errorMessage = status.error_message || 'Refresh failed'
        console.error(`Job ${jobId} failed:`, errorMessage)
        throw new Error(errorMessage)
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      attempts++
    }
    
    throw new Error('Refresh timeout - job is taking too long. Check server logs for details.')
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  const filteredModels = models.filter(
    (model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading models...</p>
        </div>
      </div>
    )
  }

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
          <Button variant="outline" size="sm" className="gap-2" onClick={loadModels}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reload
          </Button>
          <Button size="sm" className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Model
          </Button>
        </div>
      </header>

      {/* Create/Edit Model Dialog */}
      <CreateModelDialog
        open={createDialogOpen || !!editingModel}
        onOpenChange={(open) => {
          setCreateDialogOpen(open)
          if (!open) setEditingModel(null)
        }}
        onSuccess={async () => {
          console.log('[Model Catalog] Model saved, reloading...')
          await loadModels()
          setEditingModel(null)
          // Force re-select the model to see updated data
          if (selectedModel && editingModel) {
            const updatedModels = await fetch('/api/catalog').then(r => r.json())
            const updatedModel = updatedModels.catalog?.find((m: any) => m.id === selectedModel.id)
            if (updatedModel) {
              setSelectedModel(updatedModel)
              console.log('[Model Catalog] Updated selected model:', updatedModel)
            }
          }
        }}
        editModel={editingModel}
      />

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
            {filteredModels.length === 0 ? (
              <div className="text-center py-12">
                <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  No models found. Create your first model to get started.
                </p>
                <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Your First Model
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredModels.map((model) => {
                  const isSelected = selectedModel?.id === model.id
                  return (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModel(model)}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors",
                        isSelected ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-accent",
                      )}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="rounded-md bg-muted p-1.5">
                            <Database className="h-4 w-4" />
                          </div>
                          <span className="font-mono text-sm font-medium text-foreground">{model.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {model.materialized_rows}
                        </Badge>
                      </div>
                      <p className="mb-2 text-xs text-muted-foreground">{model.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {model.type}
                        </Badge>
                        <span>•</span>
                        <span>{formatDate(model.last_refresh_at)}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Model Detail */}
        <div className="flex-1 overflow-auto">
          {!selectedModel ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a model to view details
            </div>
          ) : (
            <div className="p-6">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <div className="rounded-lg bg-muted p-2">
                      <Database className="h-5 w-5" />
                    </div>
                    <h1 className="font-mono text-2xl font-bold text-foreground">{selectedModel.name}</h1>
                  </div>
                  <p className="text-muted-foreground">{selectedModel.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setEditingModel(selectedModel)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refreshModel(selectedModel.id)}
                    disabled={refreshing === selectedModel.id}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5 mr-2", refreshing === selectedModel.id && "animate-spin")} />
                    Refresh
                  </Button>
                  <Button size="sm">Use in Workbook</Button>
                </div>
              </div>

            <Tabs defaultValue="sql" className="space-y-4">
              <TabsList>
                <TabsTrigger value="sql">SQL Definition</TabsTrigger>
                <TabsTrigger value="metadata">Metadata</TabsTrigger>
              </TabsList>

              <TabsContent value="sql" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">SQL Query</CardTitle>
                    <CardDescription>The SQL definition for this model</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedModel.sql_definition ? (
                      <pre className="rounded-lg bg-muted p-4 font-mono text-sm text-foreground overflow-x-auto whitespace-pre-wrap">
                        {selectedModel.sql_definition}
                      </pre>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        Table model: {selectedModel.database}.{selectedModel.schema}.{selectedModel.name}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Dimensions</CardTitle>
                    <CardDescription>Available dimensions for filtering</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedModel.dimension_columns && selectedModel.dimension_columns.length > 0 ? (
                        selectedModel.dimension_columns.map((dim) => (
                          <Badge key={dim} variant="secondary" className="font-mono">
                            {dim}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No dimensions defined</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Measures</CardTitle>
                    <CardDescription>Available measures for metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedModel.measure_columns && selectedModel.measure_columns.length > 0 ? (
                        selectedModel.measure_columns.map((measure) => (
                          <Badge key={measure} variant="outline" className="font-mono">
                            {measure}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">No measures defined</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="metadata" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Source</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Database</span>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                          {selectedModel.database}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Schema</span>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                          {selectedModel.schema}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Table/View</span>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                          {selectedModel.name}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Type</span>
                        <Badge variant="outline">{selectedModel.type}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Date column</span>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                          {selectedModel.primary_date_column || 'Not set'}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Date grain</span>
                        <Badge variant="outline">{selectedModel.date_grain || 'day'}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Materialized rows</span>
                        <span className="font-medium text-foreground">
                          {selectedModel.materialized_rows.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Last refresh</span>
                        <span className="text-foreground">{formatDate(selectedModel.last_refresh_at)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {selectedModel.date_range && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Date Range</CardTitle>
                      <CardDescription>Available data range in materialized model</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">From</span>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                          {selectedModel.date_range.min}
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">To</span>
                        <code className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-foreground">
                          {selectedModel.date_range.max}
                        </code>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
          )}
        </div>
      </div>
    </div>
  )
}
