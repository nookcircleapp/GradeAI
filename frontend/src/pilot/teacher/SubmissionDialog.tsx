import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '../components/Spinner'
import { papers, type Paper, type SubmissionDetail } from '../api'
import { errorMessage, formatTime } from '../format'

interface Props {
  paper: Paper
  submissionId: number | null
  onClose: () => void
  onChanged: () => void
}

/** One student's answers, the AI's reasoning, and the teacher's review. */
export function SubmissionDialog({ paper, submissionId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<SubmissionDetail | null>(null)
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [fooled, setFooled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (submissionId === null) return
    let cancelled = false
    papers
      .submission(paper.id, submissionId)
      .then((d) => {
        if (cancelled) return
        setDetail(d)
        setOverrides(Object.fromEntries(Object.entries(d.overrides).map(([k, v]) => [k, String(v)])))
        setNote(d.teacher_note)
        setFooled(!!d.ai_fooled)
      })
      .catch((e) => toast.error(errorMessage(e)))
    return () => {
      cancelled = true
      setDetail(null)
    }
  }, [paper.id, submissionId])

  const saveReview = async () => {
    if (!detail) return
    setBusy(true)
    try {
      const body: Record<string, number | null> = {}
      paper.questions.forEach((_, i) => {
        const raw = (overrides[String(i)] ?? '').trim()
        body[String(i)] = raw === '' ? null : Number(raw)
      })
      const updated = await papers.review(paper.id, detail.id, { overrides: body, teacher_note: note, ai_fooled: fooled })
      setDetail(updated)
      toast.success('Review saved')
      onChanged()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const act = async (fn: () => Promise<unknown>, message: string, close = false) => {
    setBusy(true)
    try {
      await fn()
      toast.success(message)
      onChanged()
      if (close) onClose()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={submissionId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        {!detail ? (
          <>
            <DialogTitle className="sr-only">Loading answers</DialogTitle>
            <Spinner />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{detail.student_name}</DialogTitle>
              <DialogDescription>
                Roll no {detail.roll_number}
                {detail.section ? ` · ${detail.section}` : ''}
                {detail.submitted_at ? ` · Submitted ${formatTime(detail.submitted_at)}` : ' · Still writing'}
                {detail.grading_model ? ` · Graded by ${detail.grading_model}` : ''}
              </DialogDescription>
            </DialogHeader>

            {detail.status === 'failed' && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <span className="flex-1">Grading failed: {detail.grading_error}</span>
                <Button size="sm" disabled={busy} onClick={() => act(() => papers.regrade(paper.id, detail.id), 'Regrading started', true)}>
                  Regrade
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {paper.questions.map((q, i) => {
                const answer = detail.answers.find((a) => a.question_index === i)?.answer ?? ''
                const grade = detail.grades?.find((g) => g.question_index === i)
                return (
                  <section key={i} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start gap-2">
                      <span className="text-[13px] font-bold text-slate-600">Q{i + 1}</span>
                      <span className="flex-1 font-semibold">{q.text}</span>
                      {grade && (
                        <span className="whitespace-nowrap font-bold tabular-nums">
                          AI {grade.score} / {grade.max_score}
                        </span>
                      )}
                    </div>
                    <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{answer || <em className="text-slate-500">No answer</em>}</div>
                    {grade && (
                      <>
                        {grade.suspected_manipulation && (
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                            <AlertTriangle className="size-4" aria-hidden="true" /> The AI thinks this answer tried to influence the grader
                          </div>
                        )}
                        <p className="text-sm text-slate-700">{grade.explanation}</p>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          Your mark
                          <input
                            type="number"
                            min={0}
                            max={q.marks}
                            placeholder={String(grade.score)}
                            value={overrides[String(i)] ?? ''}
                            onChange={(e) => setOverrides({ ...overrides, [String(i)]: e.target.value })}
                            className="h-9 w-20 rounded-lg border border-slate-300 text-center"
                          />
                          <span>/ {q.marks} (leave empty to keep the AI's mark)</span>
                        </label>
                      </>
                    )}
                  </section>
                )
              })}
            </div>

            {detail.grades && (
              <section className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={fooled} onChange={(e) => setFooled(e.target.checked)} className="size-4 accent-blue-700" />
                  The AI was fooled by this paper
                </label>
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-semibold">Note (for your records)</span>
                  <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="rounded-lg border border-slate-300 bg-white p-2.5" />
                </label>
                <Button className="self-start" disabled={busy} onClick={saveReview}>
                  Save review
                </Button>
              </section>
            )}

            <div className="flex justify-end border-t border-slate-200 pt-3">
              <Button
                variant="danger-ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete ${detail.student_name}'s attempt so they can start again?`)) {
                    act(() => papers.resetAttempt(paper.id, detail.id), 'Attempt reset', true)
                  }
                }}
              >
                Reset attempt
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
