import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Wordmark } from '../components/Brand'
import { ErrorNote } from '../components/Spinner'
import { auth } from '../api'
import { errorMessage } from '../format'
import { navigate } from '../router'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await auth.login(email.trim(), password)
      const next = new URLSearchParams(window.location.search).get('next')
      navigate(next && next.startsWith('/t') ? next : '/t', true)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-28px)] items-center justify-center bg-slate-100 px-6 py-12">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Wordmark pilot />
        <div>
          <h1 className="text-xl font-bold">Teacher sign-in</h1>
          <p className="mt-1 text-sm text-slate-600">Use the account your admin created for you.</p>
        </div>
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
        {error && <ErrorNote message={error} />}
        <Button type="submit" className="h-11 font-semibold" disabled={busy || !email || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
