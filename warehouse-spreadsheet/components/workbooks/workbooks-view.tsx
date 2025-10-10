"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Plus, Table2, Clock, User, MoreVertical, Copy, Trash2, FileText, Star, StarOff } from "lucide-react"
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
  description: string
  created_at: string
  updated_at: string
  last_opened_at: string | null
  starred?: boolean
  scenarios?: number
  author?: string
}

export function WorkbooksView() {
  const router = useRouter()
  const [workbooks, setWorkbooks] = useState<Workbook[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newWorkbookName, setNewWorkbookName] = useState("")
  const [newWorkbookDescription, setNewWorkbookDescription] = useState("")

  // Load workbooks on mount
  useEffect(() => {
    loadWorkbooks()
  }, [])

  const loadWorkbooks = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/workbooks')
      if (!response.ok) throw new Error('Failed to fetch workbooks')
      const data = await response.json()
      setWorkbooks(data.workbooks || [])
    } catch (error) {
      console.error('Error loading workbooks:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateWorkbook = async () => {
    if (!newWorkbookName.trim()) return

    try {
      setIsCreating(true)
      const response = await fetch('/api/workbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWorkbookName,
          description: newWorkbookDescription
        })
      })

      if (!response.ok) throw new Error('Failed to create workbook')
      
      const data = await response.json()
      
      // Close dialog and reset form
      setIsCreateDialogOpen(false)
      setNewWorkbookName("")
      setNewWorkbookDescription("")
      
      // Redirect to the new workbook
      router.push(`/workbook?id=${data.workbook.id}`)
    } catch (error) {
      console.error('Error creating workbook:', error)
      alert('Failed to create workbook. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const filteredWorkbooks = workbooks.filter(
    (workbook) =>
      workbook.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      workbook.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const starredWorkbooks = filteredWorkbooks.filter((w) => w.starred)
  const otherWorkbooks = filteredWorkbooks.filter((w) => !w.starred)

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
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateWorkbook}
                    disabled={isCreating || !newWorkbookName.trim()}
                  >
                    {isCreating ? "Creating..." : "Create Workbook"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Starred Workbooks */}
          {starredWorkbooks.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-4 flex items-center gap-2 font-sans text-lg font-semibold text-foreground">
                <Star className="h-4 w-4 fill-warning text-warning" />
                Starred
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {starredWorkbooks.map((workbook) => (
                  <WorkbookCard key={workbook.id} workbook={workbook} />
                ))}
              </div>
            </div>
          )}

          {/* All Workbooks */}
          <div>
            <h3 className="mb-4 font-sans text-lg font-semibold text-foreground">
              {starredWorkbooks.length > 0 ? "All Workbooks" : "Your Workbooks"}
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {otherWorkbooks.map((workbook) => (
                <WorkbookCard key={workbook.id} workbook={workbook} />
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 text-muted-foreground">Loading workbooks...</div>
            </div>
          ) : filteredWorkbooks.length === 0 ? (
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
          ) : null}
        </div>
      </div>
    </div>
  )
}

function WorkbookCard({ workbook }: { workbook: Workbook }) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return date.toLocaleDateString()
  }

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
            <CardDescription className="text-xs">{workbook.description || 'No description'}</CardDescription>
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
                {workbook.starred ? (
                  <>
                    <StarOff className="mr-2 h-4 w-4" />
                    Unstar
                  </>
                ) : (
                  <>
                    <Star className="mr-2 h-4 w-4" />
                    Star
                  </>
                )}
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
            {workbook.author && (
              <div className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>{workbook.author}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDate(workbook.updated_at)}</span>
            </div>
          </div>
          {workbook.scenarios !== undefined && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {workbook.scenarios} scenario{workbook.scenarios !== 1 ? "s" : ""}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
