import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ErrorNote } from '../components/Spinner'
import { wordCount } from '../format'
import type { PublicPaper } from '../api'
import type { Attempt } from './attemptStore'

interface Props {
  paper: PublicPaper
  attempt: Attempt
  busy: boolean
  error: string | null
  onChange: (attempt: Attempt) => void
  onSubmit: () => void
}

function useCountdown(deadline: string | null): number | null {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!deadline) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [deadline])
  return deadline ? Math.max(0, Math.floor((new Date(deadline).getTime() - now) / 1000)) : null
}

function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function ExamSheet({ paper, attempt, busy, error, onChange, onSubmit }: Props) {
  const [confirming, setConfirming] = useState(false)
  const remaining = useCountdown(attempt.deadline)
  const autoSubmitted = useRef(false)
  const total = paper.questions.length
  const index = Math.min(attempt.current, total - 1)
  const question = paper.questions[index]
  const answer = attempt.answers[index] ?? ''
  const words = wordCount(answer)
  const unanswered = paper.questions.filter((_, i) => !(attempt.answers[i] ?? '').trim()).length

  // Time is up: submit what is there rather than lose it.
  useEffect(() => {
    if (remaining === 0 && !autoSubmitted.current && !busy) {
      autoSubmitted.current = true
      onSubmit()
    }
  }, [remaining, busy, onSubmit])

  const go = (next: number) => onChange({ ...attempt, current: next })

  return (
    <div className="flex min-h-[calc(100vh-28px)] flex-col bg-slate-50">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-col gap-3 border-b border-slate-200 bg-white px-5 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold">
              Question {index + 1} of {total}
            </span>
            {remaining !== null && (
              <span
                className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[15px] font-bold tabular-nums ${
                  remaining < 300 ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-900'
                }`}
                aria-label={`Time left ${clock(remaining)}`}
              >
                <Clock className="size-4" aria-hidden="true" />
                {clock(remaining)}
              </span>
            )}
          </div>
          <div className="flex gap-1.5" aria-hidden="true">
            {paper.questions.map((_, i) => (
              <button
                key={i}
                type="button"
                tabIndex={-1}
                onClick={() => go(i)}
                className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-blue-700' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-3.5 p-5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[13px] font-semibold text-blue-700">
              {question.marks} mark{question.marks === 1 ? '' : 's'}
            </span>
            {question.min_words > 0 && (
              <span className="text-[13px] text-slate-600">Aim for at least {question.min_words} words</span>
            )}
          </div>
          <h1 className="text-[21px] font-bold leading-snug whitespace-pre-line">{question.text}</h1>
          <label htmlFor="answer" className="text-sm font-semibold text-slate-600">
            Your answer
          </label>
          <textarea
            id="answer"
            value={answer}
            onChange={(e) => onChange({ ...attempt, answers: { ...attempt.answers, [index]: e.target.value } })}
            className="min-h-[300px] flex-1 resize-none rounded-2xl border-[1.5px] border-slate-300 bg-white p-3.5 text-base leading-relaxed outline-none focus:border-blue-700"
          />
          <div className="flex justify-between text-[13px] text-slate-600">
            <span>Saved on this device</span>
            <span className={question.min_words && words < question.min_words ? 'text-amber-700' : ''}>
              {words} word{words === 1 ? '' : 's'}
            </span>
          </div>
          {error && <ErrorNote message={error} />}
        </main>

        <footer className="sticky bottom-0 flex gap-3 border-t border-slate-200 bg-white px-5 pb-7 pt-3">
          <Button
            variant="outline"
            className="h-13 flex-1 rounded-2xl text-base"
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            Back
          </Button>
          {index < total - 1 ? (
            <Button className="h-13 flex-[2] rounded-2xl text-base font-bold" onClick={() => go(index + 1)}>
              Next question
            </Button>
          ) : (
            <Button
              className="h-13 flex-[2] rounded-2xl text-base font-bold"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              {busy ? 'Submitting…' : 'Submit paper'}
            </Button>
          )}
        </footer>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit your paper?</DialogTitle>
            <DialogDescription>
              {unanswered
                ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} still empty. `
                : ''}
              You can't change your answers after submitting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep writing
            </Button>
            <Button
              onClick={() => {
                setConfirming(false)
                onSubmit()
              }}
            >
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
