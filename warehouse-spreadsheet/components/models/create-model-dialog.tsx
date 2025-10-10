"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, X, Database } from "lucide-react"

interface CreateModelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  editModel?: {
    id: string
    name: string
    database: string
    schema: string
    sql_definition?: string
    primary_date_column?: string
    dimension_columns: string[]
    measure_columns: string[]
  } | null
}

export function CreateModelDialog({ open, onOpenChange, onSuccess, editModel = null }: CreateModelDialogProps) {
  const isEditMode = !!editModel
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [name, setName] = useState("")
  const [database, setDatabase] = useState("ANALYTICS")
  const [schema, setSchema] = useState("PUBLIC")
  const [sql, setSql] = useState(`SELECT 
  DATE(created_at) as created_dt,
  channel,
  region,
  COUNT(DISTINCT user_id) as new_users,
  SUM(initial_value) as signup_revenue
FROM raw.users
WHERE created_at >= '2024-01-01'
GROUP BY DATE(created_at), channel, region
ORDER BY created_dt`)
  const [dateColumn, setDateColumn] = useState("created_dt")
  const [dimensions, setDimensions] = useState<string[]>(["channel", "region"])
  const [measures, setMeasures] = useState<string[]>(["new_users", "signup_revenue"])
  const [newDimension, setNewDimension] = useState("")
  const [newMeasure, setNewMeasure] = useState("")

  // Load edit data when editModel changes
  useEffect(() => {
    if (editModel) {
      setName(editModel.name)
      setDatabase(editModel.database)
      setSchema(editModel.schema)
      setSql(editModel.sql_definition || '')
      setDateColumn(editModel.primary_date_column || 'created_dt')
      setDimensions(editModel.dimension_columns || [])
      setMeasures(editModel.measure_columns || [])
    } else {
      // Reset to defaults for create mode
      setName("")
      setDatabase("ANALYTICS")
      setSchema("PUBLIC")
      setSql(`SELECT 
  DATE(created_at) as created_dt,
  channel,
  region,
  COUNT(DISTINCT user_id) as new_users,
  SUM(initial_value) as signup_revenue
FROM raw.users
WHERE created_at >= '2024-01-01'
GROUP BY DATE(created_at), channel, region
ORDER BY created_dt`)
      setDateColumn("created_dt")
      setDimensions(["channel", "region"])
      setMeasures(["new_users", "signup_revenue"])
    }
  }, [editModel])

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    try {
      const endpoint = isEditMode ? `/api/models/${editModel.id}` : '/api/models/create'
      const method = isEditMode ? 'PATCH' : 'POST'
      
      const payload = {
        org_id: 'default_org',
        name,
        database,
        schema,
        model_type: 'view',
        sql_definition: sql,
        primary_date_column: dateColumn,
        date_grain: 'day',
        dimension_columns: dimensions,
        measure_columns: measures,
      };
      
      console.log(`[Model Dialog] ${method} ${endpoint}`, payload);
      
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        console.error('[Model Dialog] Error response:', data);
        throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} model`)
      }

      const result = await response.json();
      console.log('[Model Dialog] ✅ Success:', result);

      // Success!
      onSuccess()
      onOpenChange(false)
      
      // Reset form (only needed for create mode)
      if (!isEditMode) {
        setName("")
        setDatabase("ANALYTICS")
        setSchema("PUBLIC")
        setSql("")
        setDateColumn("")
        setDimensions([])
        setMeasures([])
      }
    } catch (err) {
      console.error('[Model Dialog] ❌ Error:', err);
      setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? 'update' : 'create'} model`)
    } finally {
      setLoading(false)
    }
  }

  const addDimension = () => {
    if (newDimension && !dimensions.includes(newDimension)) {
      setDimensions([...dimensions, newDimension])
      setNewDimension("")
    }
  }

  const removeDimension = (dim: string) => {
    setDimensions(dimensions.filter(d => d !== dim))
  }

  const addMeasure = () => {
    if (newMeasure && !measures.includes(newMeasure)) {
      setMeasures([...measures, newMeasure])
      setNewMeasure("")
    }
  }

  const removeMeasure = (measure: string) => {
    setMeasures(measures.filter(m => m !== measure))
  }

  const loadExample = (type: 'new_users' | 'revenue') => {
    if (type === 'new_users') {
      setName('new_users')
      setDatabase('ANALYTICS')
      setSchema('PUBLIC')
      setSql(`SELECT 
  DATE(created_at) as created_dt,
  channel,
  region,
  COUNT(DISTINCT user_id) as new_users,
  SUM(initial_value) as signup_revenue
FROM raw.users
WHERE created_at >= '2024-01-01'
GROUP BY DATE(created_at), channel, region
ORDER BY created_dt`)
      setDateColumn('created_dt')
      setDimensions(['channel', 'region'])
      setMeasures(['new_users', 'signup_revenue'])
    } else if (type === 'revenue') {
      setName('revenue')
      setDatabase('ANALYTICS')
      setSchema('PUBLIC')
      setSql(`SELECT 
  DATE(order_date) as order_dt,
  product,
  region,
  status,
  COUNT(DISTINCT order_id) as orders,
  SUM(amount) as revenue,
  AVG(amount) as avg_order_value
FROM raw.orders
WHERE order_date >= '2024-01-01'
  AND status = 'completed'
GROUP BY DATE(order_date), product, region, status
ORDER BY order_dt`)
      setDateColumn('order_dt')
      setDimensions(['product', 'region', 'status'])
      setMeasures(['orders', 'revenue', 'avg_order_value'])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            {isEditMode ? 'Edit Model' : 'Create New Model'}
          </DialogTitle>
          <DialogDescription>
            Define a model with SQL that returns data at the finest grain (daily with dimensions).
            This data will be materialized and used to calculate metrics.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick examples (only show in create mode) */}
          {!isEditMode && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadExample('new_users')}
              >
                Load "New Users" Example
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadExample('revenue')}
              >
                Load "Revenue" Example
              </Button>
            </div>
          )}

          {/* Basic info */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="name">Model Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., new_users"
              />
            </div>
            <div>
              <Label htmlFor="database">Database</Label>
              <Input
                id="database"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="ANALYTICS"
              />
            </div>
            <div>
              <Label htmlFor="schema">Schema</Label>
              <Input
                id="schema"
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                placeholder="PUBLIC"
              />
            </div>
          </div>

          {/* SQL Definition */}
          <div>
            <Label htmlFor="sql">SQL Definition *</Label>
            <div className="text-xs text-muted-foreground mb-2">
              Must include: date column, dimensions (optional), and measures
            </div>
            <textarea
              id="sql"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              className="w-full h-64 p-3 font-mono text-sm rounded-md border border-input bg-background"
              placeholder="SELECT DATE(created_at) as date_value, ..."
            />
          </div>

          {/* Date column */}
          <div>
            <Label htmlFor="dateColumn">Date Column Name *</Label>
            <Input
              id="dateColumn"
              value={dateColumn}
              onChange={(e) => setDateColumn(e.target.value)}
              placeholder="e.g., created_dt"
            />
            <div className="text-xs text-muted-foreground mt-1">
              The column name in your SELECT that contains the date
            </div>
          </div>

          {/* Dimensions */}
          <div>
            <Label>Dimension Columns</Label>
            <div className="text-xs text-muted-foreground mb-2">
              Columns you can filter by (e.g., channel, region, product)
            </div>
            <div className="flex gap-2 mb-2">
              <Input
                value={newDimension}
                onChange={(e) => setNewDimension(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addDimension()}
                placeholder="Add dimension column"
              />
              <Button type="button" onClick={addDimension} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {dimensions.map((dim) => (
                <Badge key={dim} variant="secondary" className="gap-1">
                  {dim}
                  <button
                    onClick={() => removeDimension(dim)}
                    className="ml-1 hover:bg-muted rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Measures */}
          <div>
            <Label>Measure Columns *</Label>
            <div className="text-xs text-muted-foreground mb-2">
              Numeric columns you want to aggregate (e.g., revenue, count, orders)
            </div>
            <div className="flex gap-2 mb-2">
              <Input
                value={newMeasure}
                onChange={(e) => setNewMeasure(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addMeasure()}
                placeholder="Add measure column"
              />
              <Button type="button" onClick={addMeasure} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {measures.map((measure) => (
                <Badge key={measure} variant="outline" className="gap-1">
                  {measure}
                  <button
                    onClick={() => removeMeasure(measure)}
                    className="ml-1 hover:bg-muted rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !name || !sql || !dateColumn || measures.length === 0}
          >
            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Model' : 'Create Model')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

