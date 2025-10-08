import { Database, Table2, Code2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Table2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-sans text-xl font-semibold text-foreground">Warehouse Sheets</span>
          </div>
          <nav className="flex items-center gap-6">
            <a href="/workbooks" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Workbooks
            </a>
            <a href="/models" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Models
            </a>
            <a href="/sql-console" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              SQL Console
            </a>
            <Button size="sm" asChild>
              <a href="/workbooks">Get Started</a>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="secondary" className="mb-4">
            Warehouse-Native Spreadsheets
          </Badge>
          <h1 className="mb-6 font-sans text-5xl font-bold leading-tight tracking-tight text-foreground text-balance">
            Finance modeling meets data warehouse power
          </h1>
          <p className="mb-8 text-lg leading-relaxed text-muted-foreground text-pretty">
            Build spreadsheets that pull metrics directly from Snowflake by period. Combine warehouse data with manual
            assumptions in a familiar spreadsheet interface.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" className="gap-2" asChild>
              <a href="/workbooks">
                <Table2 className="h-4 w-4" />
                Create Workbook
              </a>
            </Button>
            <Button size="lg" variant="outline" className="gap-2 bg-transparent" asChild>
              <a href="/sql-console">
                <Code2 className="h-4 w-4" />
                Open SQL Console
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Table2 className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Spreadsheet UX</CardTitle>
              <CardDescription>
                Familiar Excel-like interface with custom METRIC() and METRICRANGE() functions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md bg-muted p-3 font-mono text-sm">=METRIC("revenue", "2024-Q1")</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Database className="h-5 w-5 text-success" />
              </div>
              <CardTitle>Snowflake Integration</CardTitle>
              <CardDescription>Write SQL models that become reusable metrics across all your workbooks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant="outline" className="font-mono text-xs">
                  revenue
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  expenses
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  gross_margin
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <RefreshCw className="h-5 w-5 text-warning" />
              </div>
              <CardTitle>Scheduled Refresh</CardTitle>
              <CardDescription>
                Automatic cache warm-up ensures your metrics are always ready when you need them
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-success" />
                Last refreshed 5 minutes ago
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Design System Preview */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-8 text-center font-sans text-3xl font-bold text-foreground">Design System Preview</h2>
        <div className="grid gap-8 md:grid-cols-2">
          {/* Color Palette */}
          <Card>
            <CardHeader>
              <CardTitle>Color Palette</CardTitle>
              <CardDescription>Finance-focused with deep blue and emerald accents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary" />
                <div>
                  <div className="font-medium text-foreground">Primary</div>
                  <div className="text-sm text-muted-foreground">Deep blue for trust</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-success" />
                <div>
                  <div className="font-medium text-foreground">Success</div>
                  <div className="text-sm text-muted-foreground">Emerald for positive data</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-warning" />
                <div>
                  <div className="font-medium text-foreground">Warning</div>
                  <div className="text-sm text-muted-foreground">Amber for alerts</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Typography */}
          <Card>
            <CardHeader>
              <CardTitle>Typography</CardTitle>
              <CardDescription>Clean, readable fonts for data-dense interfaces</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Heading / Sans-serif</div>
                <div className="font-sans text-2xl font-bold text-foreground">Geist Sans</div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Body / Sans-serif</div>
                <div className="font-sans text-base text-foreground">The quick brown fox jumps over the lazy dog</div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Code / Monospace</div>
                <div className="font-mono text-sm text-foreground">SELECT * FROM metrics WHERE period = '2024-Q1'</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
