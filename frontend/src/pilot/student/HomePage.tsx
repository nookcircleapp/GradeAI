import { useState, type FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Wordmark } from '../components/Brand'
import { Link } from '../components/Link'
import { navigate } from '../router'

/** Students land here and type the code the teacher projects. */
export function HomePage() {
  const [code, setCode] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = code.replace(/[^a-z0-9]/gi, '').toUpperCase()
    if (clean) navigate(`/p/${clean}`)
  }

  return (
    <div className="flex min-h-[calc(100vh-28px)] flex-col bg-blue-700">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-12 text-white">
        <div className="rounded-xl bg-white/95 px-3 py-2 self-start">
          <Wordmark />
        </div>
        <h1 className="mt-10 text-3xl font-extrabold leading-tight">Join your exam</h1>
        <p className="mt-2 text-blue-100">Type the code your teacher shows on the screen.</p>
        <form onSubmit={submit} className="mt-8 flex flex-col gap-4 rounded-3xl bg-white p-6 text-slate-900">
          <label htmlFor="code" className="text-sm font-semibold">
            Exam code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="e.g. K7Q2MD"
            className="h-14 rounded-xl border-[1.5px] border-slate-300 px-4 text-center text-2xl font-bold tracking-[0.2em] uppercase outline-none focus:border-blue-700"
          />
          <Button type="submit" size="lg" className="h-14 rounded-xl text-base font-bold" disabled={!code.trim()}>
            Continue <ArrowRight className="size-5" aria-hidden="true" />
          </Button>
        </form>
        <div className="mt-auto pt-10 text-center text-sm text-blue-100">
          Teacher? <Link href="/login" className="font-semibold text-white underline">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
