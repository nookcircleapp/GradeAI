import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link } from '../components/Link'
import { ErrorNote, Spinner } from '../components/Spinner'
import { admin, papers, type Paper, type RecordPaper, type RecordRow, type User } from '../api'
import { errorMessage, formatDate } from '../format'
import { SubmissionDialog } from './SubmissionDialog'

const STATUS: Record<RecordRow['status'], string> = {
  in_progress: 'Still writing',
  grading: 'Grading…',
  graded: 'Graded',
  failed: 'Grading failed',
}

/** /t/records — admins see every student's answers on every paper in one grid. */
export function AllRecordsPage({ me }: { me: User }) {
  const [data, setData] = useState<{ papers: RecordPaper[]; rows: RecordRow[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [paperId, setPaperId] = useState<number | 'all'>('all')
  const [query, setQuery] = useState('')
  const [wrap, setWrap] = useState(false)
  const [open, setOpen] = useState<{ paper: Paper; id: number } | null>(null)

  const load = () => admin.records().then(setData).catch((e) => setError(errorMessage(e)))
  useEffect(() => {
    load()
  }, [])

  const byId = useMemo(() => new Map((data?.papers ?? []).map((p) => [p.id, p])), [data])

  if (me.role !== 'admin') return <div className="mx-auto max-w-6xl p-6"><ErrorNote message="Only admins can see every paper's records." /></div>
  if (error) return <div className="mx-auto max-w-6xl p-6"><ErrorNote message={error} /></div>
  if (!data) return <Spinner />

  const selected = paperId === 'all' ? null : byId.get(paperId) ?? null
  const q = query.trim().toLowerCase()
  const rows = data.rows.filter((r) => {
    if (selected && r.paper_id !== selected.id) return false
    return !q || r.student_name.toLowerCase().includes(q) || r.roll_number.toLowerCase().includes(q)
  })
  const questionCount = selected ? selected.questions.length : Math.max(0, ...rows.map((r) => r.answers.length))
  const counts = new Map<number, number>()
  data.rows.forEach((r) => counts.set(r.paper_id, (counts.get(r.paper_id) ?? 0) + 1))

  const openRow = async (r: RecordRow) => {
    try {
      setOpen({ paper: await papers.get(r.paper_id), id: r.submission_id })
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const th = 'px-3 py-2.5 text-left font-semibold whitespace-nowrap'
  const td = 'px-3 py-2.5 align-top'

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">All records</h1>
          <p className="mt-1 text-sm text-slate-600">
            Every student's answers and scores across {data.papers.length} papers. Click a student to see the AI's reasoning or adjust marks.
          </p>
        </div>
        <Button asChild variant="outline" className="h-10">
          <a href={admin.recordsExportUrl()} download>
            <Download className="size-4" aria-hidden="true" /> Download Excel
          </a>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Paper"
          value={paperId}
          onChange={(e) => setPaperId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="h-10 max-w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="all">All papers ({data.rows.length} students)</option>
          {data.papers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.teacher} ({counts.get(p.id) ?? 0})
            </option>
          ))}
        </select>
        <Input
          placeholder="Search name or roll number"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 w-64 max-w-full bg-white"
        />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} className="size-4 accent-blue-700" />
          Show full answers
        </label>
        {selected && (
          <Link href={`/t/papers/${selected.id}/records`} className="text-sm font-semibold text-blue-700">
            Open this paper's records page
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-600">No students yet.</p>
      ) : (
        <div className="max-h-[75vh] overflow-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600 shadow-[0_1px_0_#e2e8f0]">
              <tr>
                {!selected && <th className={th}>Paper</th>}
                {!selected && <th className={th}>Teacher</th>}
                <th className={`${th} sticky left-0 bg-slate-50`}>Student</th>
                <th className={th}>Roll no.</th>
                <th className={th}>Section</th>
                <th className={th}>Status</th>
                <th className={th}>Score</th>
                {Array.from({ length: questionCount }, (_, i) => (
                  <th key={i} className={`${th} min-w-[220px] max-w-[320px] whitespace-normal`}>
                    {selected ? (
                      <span title={selected.questions[i]}>
                        Q{i + 1} <span className="font-normal">({selected.marks[i]})</span>
                        <span className="block line-clamp-2 font-normal text-slate-500">{selected.questions[i]}</span>
                      </span>
                    ) : (
                      `Q${i + 1}`
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const paper = byId.get(r.paper_id)
                return (
                  <tr key={r.submission_id} className="border-t border-slate-200 hover:bg-slate-50">
                    {!selected && (
                      <td className={`${td} max-w-[220px]`}>
                        <div className="font-medium">{paper?.title}</div>
                        <div className="text-xs text-slate-500">{formatDate(paper?.created_at ?? null)}</div>
                      </td>
                    )}
                    {!selected && <td className={`${td} whitespace-nowrap`}>{paper?.teacher}</td>}
                    <td className={`${td} sticky left-0 bg-white`}>
                      <button type="button" onClick={() => openRow(r)} className="text-left font-semibold text-blue-700 hover:underline">
                        {r.student_name}
                      </button>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{r.roll_number}</td>
                    <td className={td}>{r.section}</td>
                    <td className={`${td} whitespace-nowrap ${r.status === 'failed' || r.flagged ? 'text-amber-700' : ''}`}>
                      {STATUS[r.status]}
                      {r.flagged && <span className="block text-xs">AI flagged a trick</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap font-semibold`}>
                      {r.final_score ?? '–'} <span className="font-normal text-slate-500">/ {r.max_score}</span>
                    </td>
                    {Array.from({ length: questionCount }, (_, i) => {
                      const a = r.answers[i]
                      return (
                        <td key={i} className={`${td} max-w-[320px]`}>
                          {a && (
                            <>
                              <div className="text-xs font-semibold text-slate-500">
                                {a.score ?? '–'} / {paper?.marks[i]}
                              </div>
                              <div title={a.answer} className={`whitespace-pre-wrap break-words ${wrap ? '' : 'line-clamp-3'}`}>
                                {a.answer || <span className="text-slate-400">No answer</span>}
                              </div>
                            </>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <SubmissionDialog
          paper={open.paper}
          submissionId={open.id}
          onClose={() => setOpen(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
