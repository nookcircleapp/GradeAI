import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Wordmark } from '../components/Brand'
import { ErrorNote } from '../components/Spinner'
import type { PublicPaper } from '../api'

interface Props {
  code: string
  paper: PublicPaper
  busy: boolean
  error: string | null
  onStart: (name: string, roll: string, section: string) => void
}

export function JoinForm({ code, paper, busy, error, onStart }: Props) {
  const [name, setName] = useState('')
  const [roll, setRoll] = useState('')
  const [section, setSection] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onStart(name.trim(), roll.trim(), section.trim())
  }

  const ready = name.trim() && roll.trim() && (!paper.collect_section || section.trim())

  return (
    <div className="flex min-h-[calc(100vh-28px)] flex-col bg-blue-700">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex flex-col gap-3 px-6 pb-8 pt-10 text-white">
          <div className="self-start rounded-xl bg-white/95 px-3 py-2">
            <Wordmark />
          </div>
          <h1 className="mt-4 text-[28px] font-extrabold leading-tight">{paper.title}</h1>
          <div className="flex flex-wrap gap-2 text-[13px]">
            <span className="rounded-full bg-white/20 px-2.5 py-1">
              {paper.questions.length} question{paper.questions.length === 1 ? '' : 's'}
            </span>
            <span className="rounded-full bg-white/20 px-2.5 py-1">{paper.max_score} marks</span>
            {paper.time_limit_minutes && (
              <span className="rounded-full bg-white/20 px-2.5 py-1">{paper.time_limit_minutes} min</span>
            )}
          </div>
        </div>
        <form onSubmit={submit} className="flex flex-1 flex-col gap-5 rounded-t-3xl bg-white px-6 py-7 text-slate-900">
          {paper.state !== 'open' ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center">
              <div className="text-lg font-bold">
                {paper.state === 'closed' ? 'This exam has closed' : 'This exam has not opened yet'}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {paper.state === 'closed' ? 'Ask your teacher if you think this is a mistake.' : 'Wait for your teacher, then refresh this page.'}
              </p>
            </div>
          ) : (
            <>
              <div className="text-xl font-bold">Who's writing?</div>
              {paper.instructions && <p className="text-sm text-slate-600 whitespace-pre-line">{paper.instructions}</p>}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="name" className="text-sm font-semibold">Full name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="h-13 rounded-xl border-[1.5px] border-slate-300 px-3.5 text-base outline-none focus:border-blue-700"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="roll" className="text-sm font-semibold">Roll number</label>
                <input
                  id="roll"
                  value={roll}
                  onChange={(e) => setRoll(e.target.value)}
                  autoComplete="off"
                  className="h-13 rounded-xl border-[1.5px] border-slate-300 px-3.5 text-base tracking-wide outline-none focus:border-blue-700"
                />
                <span className="text-[13px] text-slate-600">
                  Use the roll number on your college ID. One attempt per roll number.
                </span>
              </div>
              {paper.collect_section && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="section" className="text-sm font-semibold">Class / section</label>
                  <input
                    id="section"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="h-13 rounded-xl border-[1.5px] border-slate-300 px-3.5 text-base outline-none focus:border-blue-700"
                  />
                </div>
              )}
              {error && <ErrorNote message={error} />}
              <Button type="submit" disabled={!ready || busy} className="mt-auto h-14 rounded-2xl text-[17px] font-bold">
                {busy ? 'Starting…' : 'Start exam'}
              </Button>
              <p className="text-center text-[13px] text-slate-600">
                Code {code}
                {paper.subject ? ` · ${paper.subject}` : ''}
              </p>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
