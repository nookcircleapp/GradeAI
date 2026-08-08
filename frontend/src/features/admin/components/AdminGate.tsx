import { useState } from 'react'
import { KeyRound, Loader2, Lock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AdminGateProps {
  /** Shown in red under the field — e.g. after the server rejected a password. */
  errorMessage?: string | null
  /** True while the password is being checked against the server. */
  busy?: boolean
  onUnlock: (password: string) => void
}

/**
 * Stands in place of the whole admin dashboard until the password is accepted.
 *
 * It is a panel rather than a dialog on purpose: a modal implies a usable page
 * behind it, and there is none. Nothing about the exam is fetched or rendered
 * until the server has accepted the password, so a wrong one is caught here
 * rather than after a form has been filled in.
 */
export function AdminGate({ errorMessage, busy = false, onUnlock }: AdminGateProps) {
  const [password, setPassword] = useState('')

  const submit = () => {
    const trimmed = password.trim()
    if (trimmed === '' || busy) return
    // Cleared on every attempt, so a rejected password is not sitting in the
    // field inviting a resubmit.
    setPassword('')
    onUnlock(trimmed)
  }

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" />
          Admin access
        </CardTitle>
        <CardDescription>
          Editing exams is password protected. Students never need this — the exam page is open to
          everyone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <Input
              id="admin-password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              disabled={busy}
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? 'admin-password-error' : undefined}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter admin password"
            />
            {errorMessage && (
              <p id="admin-password-error" className="text-sm text-destructive">
                {errorMessage}
              </p>
            )}
          </div>
          <Button type="submit" disabled={busy || password.trim() === ''} className="gap-2">
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <KeyRound className="size-4" />
                Unlock
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
