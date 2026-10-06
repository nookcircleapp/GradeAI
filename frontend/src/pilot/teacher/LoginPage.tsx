import { useEffect, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wordmark } from '../components/Brand'
import { ErrorNote, Spinner } from '../components/Spinner'
import { auth } from '../api'
import { errorMessage } from '../format'
import { navigate } from '../router'

// Codes the Google callback sends back in ?error=
const GOOGLE_ERRORS: Record<string, string> = {
  not_allowed: 'This Google account is not on the approved list. Ask your admin to add your email, then try again.',
  disabled: 'Your account has been disabled. Contact your admin.',
  expired: 'The sign-in took too long or was interrupted. Please try again.',
  cancelled: 'Google sign-in was cancelled.',
  google: 'Google sign-in failed. Please try again.',
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function LoginPage() {
  const params = new URLSearchParams(window.location.search)
  const nextParam = params.get('next')
  const next = nextParam && nextParam.startsWith('/t') ? nextParam : '/t'
  const googleError = params.get('error')

  const [google, setGoogle] = useState<boolean | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(googleError ? GOOGLE_ERRORS[googleError] ?? GOOGLE_ERRORS.google : null)

  useEffect(() => {
    auth
      .config()
      .then((c) => setGoogle(c.google))
      .catch(() => setGoogle(false))
  }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await auth.login(email.trim(), password)
      navigate(next, true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const passwordForm = (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11"
        />
      </div>
      <Button type="submit" variant={google ? 'outline' : 'default'} className="h-11 font-semibold" disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  )

  return (
    <div className="flex min-h-[calc(100vh-28px)] items-center justify-center bg-slate-100 px-6 py-12">
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Wordmark pilot />
        <div>
          <h1 className="text-xl font-bold">Teacher sign-in</h1>
          <p className="mt-1 text-sm text-slate-600">
            {google ? 'Sign in with the Google account your admin approved.' : 'Use the account your admin created for you.'}
          </p>
        </div>
        {error && <ErrorNote message={error} />}
        {google === null ? (
          <Spinner label="Loading" />
        ) : google ? (
          <>
            <a
              href={auth.googleStartUrl(next)}
              className="inline-flex h-12 items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 no-underline shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <GoogleIcon />
              Sign in with Google
            </a>
            {showPassword ? (
              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4">
                <p className="text-xs text-slate-600">Admin password sign-in</p>
                {passwordForm}
              </div>
            ) : (
              <button type="button" onClick={() => setShowPassword(true)} className="text-sm text-slate-600 underline-offset-2 hover:underline">
                Admin? Sign in with password
              </button>
            )}
          </>
        ) : (
          passwordForm
        )}
      </div>
    </div>
  )
}
