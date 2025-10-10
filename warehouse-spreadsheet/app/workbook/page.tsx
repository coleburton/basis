'use client'

import { SpreadsheetView } from "@/components/spreadsheet/spreadsheet-view"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useWorkbook } from "@/lib/workbook/workbook-context"

function WorkbookPageContent() {
  const searchParams = useSearchParams()
  const workbookId = searchParams.get('id')
  const [loading, setLoading] = useState(!!workbookId)
  const [error, setError] = useState<string | null>(null)
  const { loadWorkbookData, saveWorkbookData, hasUnsavedChanges } = useWorkbook()

  // Load workbook data if ID is provided
  useEffect(() => {
    if (!workbookId) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      try {
        console.log(`[Workbook Page] Loading workbook: ${workbookId}`)
        const response = await fetch(`/api/workbooks/${workbookId}`)
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('[Workbook Page] API error:', errorData)
          throw new Error(errorData.error || `Failed to load workbook (${response.status})`)
        }

        const data = await response.json()
        console.log(`[Workbook Page] Loaded workbook data:`, data.workbook)
        
        if (data.workbook && loadWorkbookData) {
          loadWorkbookData(data.workbook)
        }
      } catch (err) {
        console.error('[Workbook Page] Load error:', err)
        setError(err instanceof Error ? err.message : 'Failed to load workbook')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [workbookId, loadWorkbookData])

  // Debounced auto-save: save 3 seconds after last change
  useEffect(() => {
    if (!workbookId || !saveWorkbookData || !hasUnsavedChanges) return

    console.log('[Workbook Page] Changes detected, scheduling auto-save in 3s...')
    const timeoutId = setTimeout(() => {
      console.log('[Workbook Page] Auto-saving workbook...')
      saveWorkbookData(workbookId)
    }, 3000) // 3 seconds after last change

    return () => {
      console.log('[Workbook Page] Clearing auto-save timeout')
      clearTimeout(timeoutId)
    }
  }, [workbookId, saveWorkbookData, hasUnsavedChanges])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Loading workbook...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/workbooks" className="text-blue-600 hover:underline">
            Back to Workbooks
          </a>
        </div>
      </div>
    )
  }

  return <SpreadsheetView workbookId={workbookId || undefined} />
}

export default function WorkbookPage() {
  return <WorkbookPageContent />
}
