'use client'

import { ReactNode } from 'react'
import { WorkbookProvider } from '@/lib/workbook/workbook-context'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WorkbookProvider>
      {children}
    </WorkbookProvider>
  )
}

