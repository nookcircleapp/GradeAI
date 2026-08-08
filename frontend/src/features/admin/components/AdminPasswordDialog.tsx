import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AdminPasswordDialogProps {
  open: boolean
  /** Shown in red above the field — e.g. after the server rejected a password. */
  errorMessage?: string | null
  onSubmit: (password: string) => void
  onCancel: () => void
}

/**
 * Asks for the shared admin password before an exam write.
 *
 * This is one password field, not an auth system: it appears only when a save
 * needs a password we do not already hold, and the answer is kept for the rest
 * of the browser session.
 */
export function AdminPasswordDialog({
  open,
  errorMessage,
  onSubmit,
  onCancel,
}: AdminPasswordDialogProps) {
  const [password, setPassword] = useState('')

  // Clear on every close path, so the next prompt — including the re-prompt
  // after a rejection — starts from an empty field instead of inviting a
  // resubmit of the password the server just refused.
  const submit = () => {
    const trimmed = password.trim()
    if (trimmed === '') {
      return
    }
    setPassword('')
    onSubmit(trimmed)
  }

  const cancel = () => {
    setPassword('')
    onCancel()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          cancel()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            Admin password required
          </DialogTitle>
          <DialogDescription>
            Saving changes to the exam is password protected. Students never need
            this — only edits do.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="admin-password">Password</Label>
          <Input
            id="admin-password"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            aria-invalid={errorMessage ? true : undefined}
            aria-describedby={errorMessage ? 'admin-password-error' : undefined}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              // The dialog lives outside the exam <form>, so Enter needs wiring
              // up by hand rather than relying on implicit form submission.
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="Enter admin password"
          />
          {errorMessage && (
            <p id="admin-password-error" className="text-sm text-destructive">
              {errorMessage}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={cancel}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={password.trim() === ''}>
            Unlock &amp; Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
