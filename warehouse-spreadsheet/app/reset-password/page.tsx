import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { Table2 } from "lucide-react"

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Table2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="mb-2 font-sans text-2xl font-bold text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        {/* Reset Form */}
        <ResetPasswordForm />

        {/* Footer Links */}
        <div className="text-center text-sm text-muted-foreground">
          Remember your password?{" "}
          <a href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </a>
        </div>
      </div>
    </div>
  )
}
