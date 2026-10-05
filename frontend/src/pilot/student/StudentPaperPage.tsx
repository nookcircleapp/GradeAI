import { useCallback, useEffect, useState } from 'react'

import { ApiError } from '@/lib/api'
import { Spinner } from '../components/Spinner'
import { Link } from '../components/Link'
import { errorMessage } from '../format'
import { student, type PublicPaper, type StudentResult } from '../api'
import { clearAttempt, loadAttempt, saveAttempt, type Attempt } from './attemptStore'
import { ExamSheet } from './ExamSheet'
import { JoinForm } from './JoinForm'
import { ResultView } from './ResultView'

/** /p/:code — join, write, then see the AI result, all on one URL. */
export function StudentPaperPage({ code }: { code: string }) {
  const [paper, setPaper] = useState<PublicPaper | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState<Attempt | null>(() => loadAttempt(code))
  const [result, setResult] = useState<StudentResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    student
      .paper(code)
      .then(setPaper)
      .catch((e) => setLoadError(e instanceof ApiError && e.status === 404 ? 'No exam found for this code.' : errorMessage(e)))
  }, [code])

  const update = useCallback(
    (next: Attempt) => {
      setAttempt(next)
      saveAttempt(code, next)
    },
    [code]
  )

  // After submitting, poll until the AI has finished grading.
  useEffect(() => {
    if (!attempt?.submitted) return
    let stopped = false
    let timer: number | undefined
    const poll = async () => {
      try {
        const r = await student.result(code, attempt.receipt)
        if (stopped) return
        setResult(r)
        if (r.status !== 'graded') timer = window.setTimeout(poll, 2500)
        else if (!r.results_visible) timer = window.setTimeout(poll, 20000)
      } catch {
        if (!stopped) timer = window.setTimeout(poll, 5000)
      }
    }
    poll()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [code, attempt?.submitted, attempt?.receipt])

  const start = async (name: string, roll: string, section: string) => {
    setBusy(true)
    setError(null)
    try {
      const started = await student.start(code, { student_name: name, roll_number: roll, section })
      update({ receipt: started.receipt, name, roll, deadline: started.deadline, answers: {}, current: 0, submitted: false })
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = useCallback(async () => {
    if (!attempt || !paper) return
    setBusy(true)
    setError(null)
    try {
      const answers = paper.questions.map((_, i) => ({ question_index: i, answer: attempt.answers[i] ?? '' }))
      const r = await student.submit(code, attempt.receipt, answers)
      setResult(r)
      update({ ...attempt, submitted: true })
    } catch (e) {
      // Already submitted from another tab: just show the result.
      if (e instanceof ApiError && e.status === 409 && /already been submitted/.test(e.message)) {
        update({ ...attempt, submitted: true })
      } else if (e instanceof ApiError && e.status === 404) {
        // The teacher reset this attempt: start over with the same roll number.
        clearAttempt(code)
        setAttempt(null)
        setError('Your attempt was reset by your teacher. Please start again.')
      } else {
        setError(errorMessage(e))
      }
    } finally {
      setBusy(false)
    }
  }, [attempt, paper, code, update])

  if (loadError) {
    return (
      <div className="flex min-h-[calc(100vh-28px)] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-bold">{loadError}</h1>
        <Link href="/" className="font-semibold text-blue-700 underline">
          Try another code
        </Link>
      </div>
    )
  }
  if (!paper) return <Spinner label="Loading exam" />

  if (attempt?.submitted) {
    return result ? <ResultView result={result} questions={paper.questions} /> : <Spinner label="Loading your result" />
  }
  if (attempt) {
    return <ExamSheet paper={paper} attempt={attempt} busy={busy} error={error} onChange={update} onSubmit={submit} />
  }
  return <JoinForm code={code} paper={paper} busy={busy} error={error} onStart={start} />
}
