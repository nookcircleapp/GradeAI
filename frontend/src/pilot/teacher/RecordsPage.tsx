import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Link } from '../components/Link'
import { ErrorNote, Spinner } from '../components/Spinner'
import { papers, type Paper, type SubmissionRow } from '../api'
import { errorMessage, formatTime, winnersLink } from '../format'
import { SubmissionDialog } from './SubmissionDialog'

type Filter = 'all' | 'flagged' | 'writing'

function noteFor(r: SubmissionRow): { text: string; warn: boolean } {
  if (r.status === 'in_progress') return { text: 'Still writing', warn: false }
  if (r.status === 'grading') return { text: 'Grading…', warn: false }
  if (r.status === 'failed') return { text: 'Grading failed', warn: true }
  if (r.ai_fooled) return { text: 'Marked: AI misgraded', warn: true }
  if (r.flagged) return { text: 'AI flagged a trick', warn: true }
  return { text: 'No issues', warn: false }
}

/** /t/papers/:id/records — live record of every student on a paper. */
export function RecordsPage({ id }: { id: number }) {
  const [paper, setPaper] = useState<Paper | null>(null)
  const [rows, setRows] = useState<SubmissionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    Promise.all([papers.get(id), papers.submissions(id)])
      .then(([p, r]) => {
        setPaper(p)
        setRows(r)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [id])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 10000)
    return () => window.clearInterval(timer)
  }, [load])

  const ranked = useMemo(() => {
    const list = [...(rows ?? [])]
    const score = (r: SubmissionRow) => (paper?.is_contest ? r.ai_score : r.final_score) ?? -1
    list.sort((a, b) => score(b) - score(a) || (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''))
    return list
  }, [rows, paper?.is_contest])

  if (error) return <div className="mx-auto max-w-6xl p-6"><ErrorNote message={error} /></div>
  if (!paper || !rows) return <Spinner />

  const graded = rows.filter((r) => r.status === 'graded')
  const writing = rows.filter((r) => r.status === 'in_progress')
  const flagged = rows.filter((r) => r.flagged || r.ai_fooled)
  const totals = graded.map((r) => r.final_score ?? 0)
  const average = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null
  const top = totals.length ? Math.max(...totals) : null

  const q = query.trim().toLowerCase()
  const visible = ranked.filter((r) => {
    if (filter === 'flagged' && !(r.flagged || r.ai_fooled)) return false
    if (filter === 'writing' && r.status !== 'in_progress') return false
    return !q || r.student_name.toLowerCase().includes(q) || r.roll_number.toLowerCase().includes(q)
  })

  const run = async (fn: () => Promise<Paper>, message: string) => {
    setBusy(true)
    try {
      setPaper(await fn())
      toast.success(message)
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const closeAndAnnounce = () =>
    run(async () => {
      if (paper.status === 'open') await papers.setStatus(id, 'closed')
      return papers.revealWinners(id, true)
    }, 'Paper closed and winners published')

  const chip = (name: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(name)}
      aria-pressed={filter === name}
      className={`min-h-10 rounded-full border px-3 text-sm ${
        filter === name ? 'border-blue-700 bg-blue-50 font-semibold text-blue-700' : 'border-slate-300 bg-white text-slate-600'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-[1_1_360px]">
          <div className="text-[13px] text-slate-600">
            <Link href={`/t/papers/${id}`} className="text-blue-700 no-underline hover:underline">Edit paper</Link>
            {paper.subject ? ` · ${paper.subject}` : ''} · Code {paper.share_code}
          </div>
          <h1 className="mt-1 text-[26px] font-bold">{paper.title}</h1>
        </div>
        {paper.status === 'open' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1.5 text-[13px] font-semibold text-green-800">
            <span className="size-2 rounded-full bg-green-600" />
            Live · {writing.length} still writing
          </span>
        ) : (
          <span className="rounded-full bg-slate-200 px-2.5 py-1.5 text-[13px] font-semibold text-slate-700">
            {paper.status === 'closed' ? 'Closed' : 'Draft'}
          </span>
        )}
        <Button asChild variant="outline" className="h-11 font-semibold">
          <a href={papers.exportUrl(id)} download>
            <Download className="size-4" aria-hidden="true" /> Export to Excel (CSV)
          </a>
        </Button>
        {paper.results_mode === 'on_release' && (
          <Button
            variant="outline"
            className="h-11 font-semibold"
            disabled={busy}
            onClick={() => run(() => papers.releaseResults(id, !paper.results_released), paper.results_released ? 'Results hidden' : 'Results released to students')}
          >
            {paper.results_released ? 'Hide results' : 'Release results'}
          </Button>
        )}
        {paper.is_contest && !paper.winners_revealed && (
          <Button className="h-11 font-bold" disabled={busy || !graded.length} onClick={closeAndAnnounce}>
            Close paper and announce winners
          </Button>
        )}
        {paper.is_contest && paper.winners_revealed && (
          <Button asChild className="h-11 font-bold">
            <a href={winnersLink(paper.share_code)} target="_blank" rel="noreferrer">
              Winners screen <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </Button>
        )}
        {!paper.is_contest && paper.status === 'open' && (
          <Button className="h-11 font-bold" disabled={busy} onClick={() => run(() => papers.setStatus(id, 'closed'), 'Paper closed')}>
            Close paper
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[13px] text-slate-600">Submitted</div>
          <div className="text-[28px] font-bold">
            {rows.length - writing.length} <span className="text-base font-medium text-slate-600">of {rows.length} joined</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[13px] text-slate-600">Class average</div>
          <div className="text-[28px] font-bold">
            {average ?? '–'} <span className="text-base font-medium text-slate-600">/ {paper.max_score}</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[13px] text-slate-600">Top score</div>
          <div className="text-[28px] font-bold">
            {top ?? '–'} <span className="text-base font-medium text-slate-600">/ {paper.max_score}</span>
          </div>
        </div>
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="text-[13px] text-amber-800">Answers the AI flagged</div>
          <div className="text-[28px] font-bold">
            {flagged.length} <span className="text-base font-medium text-amber-800">to review</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="search" className="sr-only">Search students</label>
        <input
          id="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or roll no"
          className="h-10 flex-[1_1_260px] rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-700"
        />
        {chip('all', `All ${rows.length}`)}
        {chip('flagged', `Flagged ${flagged.length}`)}
        {chip('writing', `Not submitted ${writing.length}`)}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-slate-600">
              <th className="px-4 py-3 font-semibold">Rank</th>
              <th className="px-4 py-3 font-semibold">Student</th>
              <th className="px-4 py-3 font-semibold">Roll no</th>
              {paper.questions.map((q, i) => (
                <th key={i} className="px-4 py-3 text-right font-semibold">Q{i + 1} /{q.marks}</th>
              ))}
              <th className="px-4 py-3 text-right font-semibold">Total /{paper.max_score}</th>
              <th className="px-4 py-3 font-semibold">AI note</th>
              <th className="px-4 py-3 font-semibold">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr>
                <td colSpan={paper.questions.length + 6} className="px-4 py-10 text-center text-slate-600">
                  {rows.length ? 'No students match.' : `No students yet. Share code ${paper.share_code} with your class.`}
                </td>
              </tr>
            )}
            {visible.map((r) => {
              const note = noteFor(r)
              const rank = r.status === 'graded' ? ranked.filter((x) => x.status === 'graded').indexOf(r) + 1 : null
              const overridden = r.final_score !== r.ai_score
              return (
                <tr key={r.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-3 font-bold text-slate-600">{rank ?? '–'}</td>
                  <td className="px-4 py-3 font-semibold">
                    <button type="button" onClick={() => setSelected(r.id)} className="text-left text-slate-900 hover:text-blue-700 hover:underline">
                      {r.student_name}
                    </button>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{r.roll_number}</td>
                  {paper.questions.map((_, i) => (
                    <td key={i} className="px-4 py-3 text-right tabular-nums">{r.question_scores[i] ?? '–'}</td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold tabular-nums" title={overridden ? `AI gave ${r.ai_score}` : undefined}>
                    {r.final_score ?? '–'}
                    {overridden && r.final_score !== null && <span className="ml-1 text-xs font-medium text-blue-700">edited</span>}
                  </td>
                  <td className="px-4 py-3">
                    {note.warn ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">{note.text}</span>
                    ) : (
                      <span className="text-[13px] text-slate-600">{note.text}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatTime(r.submitted_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[13px] text-slate-600">
        Click a student to see their answers and the AI's reasoning per question, and to change a mark.
        {paper.is_contest ? ' The winners screen ranks on the AI score; your changes show in the total.' : ''}
      </p>

      <SubmissionDialog paper={paper} submissionId={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  )
}
