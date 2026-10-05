import { CheckCircle2, Hourglass, Trophy } from 'lucide-react'

import type { StudentResult } from '../api'
import { formatTime } from '../format'

function Ring({ score, max }: { score: number; max: number }) {
  const pct = max ? Math.round((score / max) * 1000) / 10 : 0
  return (
    <div
      className="flex size-40 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#FCD34D 0 ${pct}%, rgba(255,255,255,0.2) ${pct}% 100%)` }}
    >
      <div className="flex size-32 flex-col items-center justify-center rounded-full bg-blue-700">
        <span className="text-[40px] font-extrabold leading-none">{score}</span>
        <span className="text-sm text-blue-100">out of {max}</span>
      </div>
    </div>
  )
}

export function ResultView({ result, questions }: { result: StudentResult; questions: { text: string }[] }) {
  const firstName = result.student_name.split(/\s+/)[0]

  if (result.status !== 'graded' || !result.results_visible) {
    const grading = result.status !== 'graded'
    return (
      <div className="flex min-h-[calc(100vh-28px)] flex-col items-center justify-center gap-4 bg-blue-700 px-6 text-center text-white">
        {grading ? (
          <Hourglass className="size-12 animate-pulse text-amber-300" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="size-12 text-amber-300" aria-hidden="true" />
        )}
        <h1 className="text-2xl font-extrabold">{grading ? 'The AI is grading your paper' : 'Paper submitted'}</h1>
        <p className="max-w-sm text-blue-100" role="status">
          {grading
            ? 'This usually takes under a minute. Keep this page open.'
            : 'Your teacher will release the results. Check back here later.'}
        </p>
        <p className="text-sm text-blue-200">
          {result.student_name} · Roll no {result.roll_number}
        </p>
      </div>
    )
  }

  const total = result.total_score ?? 0
  return (
    <div className="min-h-[calc(100vh-28px)] bg-slate-50">
      <section className="flex flex-col items-center gap-2.5 bg-blue-700 px-6 pb-7 pt-10 text-center text-white">
        <div className="text-sm text-blue-100">{result.paper_title}</div>
        <Ring score={total} max={result.max_score} />
        <div className="text-[22px] font-extrabold">
          {total / result.max_score >= 0.6 ? `Nice work, ${firstName}` : `Thanks, ${firstName}`}
        </div>
        {result.is_contest && result.rank && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1.5 text-sm font-bold text-blue-950">
            <Trophy className="size-4" aria-hidden="true" />
            {result.rank === 1 ? 'Top of the leaderboard so far' : `#${result.rank} of ${result.participants} so far`}
          </div>
        )}
        {result.is_contest && (
          <div className="text-[13px] text-blue-100">Final winners are announced when your teacher closes the paper.</div>
        )}
      </section>

      <main className="mx-auto flex max-w-2xl flex-col gap-3.5 p-5">
        <h2 className="text-[17px] font-bold">Question by question</h2>
        {(result.grades ?? []).map((g) => {
          const pct = g.max_score ? (g.score / g.max_score) * 100 : 0
          return (
            <article key={g.question_index} className="flex flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start gap-2.5">
                <span className="text-[13px] font-bold text-slate-600">Q{g.question_index + 1}</span>
                <span className="flex-1 text-[15px] font-semibold leading-snug">{questions[g.question_index]?.text}</span>
                <span className="whitespace-nowrap text-base font-extrabold tabular-nums">
                  {g.score} / {g.max_score}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-200">
                <div className="h-2 rounded bg-blue-700" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-sm leading-relaxed text-slate-700">{g.explanation}</p>
            </article>
          )
        })}
        <p className="py-2 text-center text-[13px] text-slate-600">
          Roll no {result.roll_number}
          {result.submitted_at ? ` · Submitted ${formatTime(result.submitted_at)}` : ''} · Your teacher can see this report
        </p>
      </main>
    </div>
  )
}
