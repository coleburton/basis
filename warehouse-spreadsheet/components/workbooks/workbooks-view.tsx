"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Plus, Table2, Clock, User, MoreVertical, Copy, Trash2, FileText, Star, StarOff, RefreshCw } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface Workbook {
  id: string
  name: string
  org_id: string
  created_by: string
  created_at: string
  updated_at: string
}

export function WorkbooksView() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newWorkbookName, setNewWorkbookName] = useState("")
  const [newWorkbookDescription, setNewWorkbookDescription] = useState("")
  const [workbooks, setWorkbooks] = useState<Workbook[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Load workbooks from API
  useEffect(() => {
    loadWorkbooks()
  }, [])

  const loadWorkbooks = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/workbooks')
      const data = await response.json()
      setWorkbooks(data.workbooks || [])
    } catch (error) {
      console.error('Failed to load workbooks:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWorkbook = async () => {
    if (!newWorkbookName.trim()) return

    try {
      setCreating(true)
      const response = await fetch('/api/workbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorkbookName,
          org_id: 'default_org',
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create workbook')
      }

      // Success! Reload workbooks and close dialog
      await loadWorkbooks()
      setIsCreateDialogOpen(false)
      setNewWorkbookName("")
      setNewWorkbookDescription("")
    } catch (error) {
      console.error('Failed to create workbook:', error)
      alert('Failed to create workbook')
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (days > 7) {
      const weeks = Math.floor(days / 7)
      return `${weeks} week${weeks > 1 ? 's' : ''} ago`
    }
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  const filteredWorkbooks = workbooks.filter((workbook) =>
    workbook.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading workbooks...</p>
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
          <h2 className="font-sans text-sm font-medium text-foreground">Workbooks</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <a href="/">Home</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/models">Models</a>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="/sql-console">SQL Console</a>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto max-w-7xl p-6">
          {/* Top Actions */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search workbooks..."
                  className="pl-9"
                />
              </div>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Workbook
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Workbook</DialogTitle>
                  <DialogDescription>Set up a new spreadsheet workbook for your analysis.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Workbook Name</Label>
                    <Input
                      id="name"
                      value={newWorkbookName}
                      onChange={(e) => setNewWorkbookName(e.target.value)}
                      placeholder="e.g., Q2 2024 Financial Model"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newWorkbookDescription}
                      onChange={(e) => setNewWorkbookDescription(e.target.value)}
                      placeholder="Brief description of this workbook"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                    disabled={creating}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateWorkbook}
                    disabled={creating || !newWorkbookName.trim()}
                  >
                    {creating ? 'Creating...' : 'Create Workbook'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* All Workbooks */}
          {filteredWorkbooks.length > 0 && (
            <div>
              <h3 className="mb-4 font-sans text-lg font-semibold text-foreground">
                Your Workbooks
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredWorkbooks.map((workbook) => (
                  <WorkbookCard 
                    key={workbook.id} 
                    workbook={workbook}
                    formatDate={formatDate}
                  />
                ))}
              </div>
            </div>
          )}

          {filteredWorkbooks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 font-sans text-lg font-semibold text-foreground">No workbooks found</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                {searchQuery ? "Try adjusting your search query" : "Create your first workbook to get started"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Workbook
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WorkbookCard({ 
  workbook, 
  formatDate 
}: { 
  workbook: Workbook
  formatDate: (date: string) => string
}) {
  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="mb-1 text-base">
              <a href={`/workbook?id=${workbook.id}`} className="hover:text-primary">
                {workbook.name}
              </a>
            </CardTitle>
            <CardDescription className="text-xs">
              Created {formatDate(workbook.created_at)}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={`/workbook?id=${workbook.id}`}>
                  <FileText className="mr-2 h-4 w-4" />
                  Open
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>Modified {formatDate(workbook.updated_at)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
