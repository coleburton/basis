import { SignupForm } from "@/components/auth/signup-form"
import { Table2 } from "lucide-react"

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Table2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="mb-2 font-sans text-2xl font-bold text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground">Get started with Warehouse Sheets today</p>
        </div>

        {/* Signup Form */}
        <SignupForm />

        {/* Footer Links */}
        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <a href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </a>
        </div>
      </div>
    </div>
  )
}
