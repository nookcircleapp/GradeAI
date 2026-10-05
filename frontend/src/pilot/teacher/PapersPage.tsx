import { useEffect, useState } from 'react'
import { FileText, Plus, Trophy } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Link } from '../components/Link'
import { ErrorNote, Spinner } from '../components/Spinner'
import { papers, type Paper } from '../api'
import { errorMessage, formatDate } from '../format'
import { navigate } from '../router'
import { STATUS_LABEL, STATUS_STYLE } from './status'

export function PapersPage() {
  const [mine, setMine] = useState<Paper[] | null>(null)
  const [templates, setTemplates] = useState<Paper[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([papers.list(), papers.templates()])
      .then(([list, premade]) => {
        setMine(list)
        setTemplates(premade)
      })
      .catch((e) => setError(errorMessage(e)))
  }, [])

  const createBlank = async () => {
    setBusy(true)
    try {
      const paper = await papers.create({
        title: 'Untitled paper',
        questions: [{ text: '', marks: 5, min_words: 0, rubric: [], reference_answer: '' }],
      })
      navigate(`/t/papers/${paper.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
      setBusy(false)
    }
  }

  const copyTemplate = async (id: number) => {
    setBusy(true)
    try {
      const paper = await papers.copy(id)
      toast.success('Copied into your papers')
      navigate(`/t/papers/${paper.id}`)
    } catch (e) {
      toast.error(errorMessage(e))
      setBusy(false)
    }
  }

  if (error) return <div className="mx-auto max-w-6xl p-6"><ErrorNote message={error} /></div>
  if (!mine) return <Spinner />

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 p-6">
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="flex-1 text-2xl font-bold">Your papers</h1>
        <Button onClick={createBlank} disabled={busy} className="h-11 font-semibold">
          <Plus className="size-4" aria-hidden="true" /> New paper
        </Button>
      </div>

      {mine.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          No papers yet. Start from a pre-made paper below, or create a new one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-600">
                <th className="px-4 py-3 font-semibold">Paper</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 text-right font-semibold">Students</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {mine.map((p) => (
                <tr key={p.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <Link href={`/t/papers/${p.id}`} className="font-semibold text-slate-900 no-underline hover:underline">
                      {p.title}
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      {p.is_contest && <Trophy className="size-3.5 text-amber-600" aria-label="Contest" />}
                      {p.subject || `${p.questions.length} questions`} · {p.max_score} marks
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold tracking-wider">{p.share_code}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.submission_count}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Link href={`/t/papers/${p.id}`} className="rounded-lg px-3 py-2 font-medium text-blue-700 no-underline hover:bg-blue-50">
                        Edit
                      </Link>
                      <Link href={`/t/papers/${p.id}/records`} className="rounded-lg px-3 py-2 font-medium text-blue-700 no-underline hover:bg-blue-50">
                        Records
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {templates.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold">Pre-made papers</h2>
          <p className="-mt-2 text-sm text-slate-600">Copy one into your papers, check it over, then publish it to your class.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <article key={t.id} className={`flex flex-col gap-3 rounded-xl border bg-white p-5 ${t.is_contest ? 'border-amber-300' : 'border-slate-200'}`}>
                <div className="flex items-start gap-3">
                  {t.is_contest ? (
                    <Trophy className="mt-0.5 size-6 flex-none text-amber-600" aria-hidden="true" />
                  ) : (
                    <FileText className="mt-0.5 size-6 flex-none text-blue-700" aria-hidden="true" />
                  )}
                  <div>
                    <h3 className="font-bold">{t.title}</h3>
                    <div className="text-sm text-slate-600">
                      {t.is_contest ? 'Contest · ' : ''}
                      {t.questions.length} questions · {t.max_score} marks
                      {t.time_limit_minutes ? ` · ${t.time_limit_minutes} min` : ''}
                    </div>
                  </div>
                </div>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                  {t.questions.map((q, i) => (
                    <li key={i}>{q.text}</li>
                  ))}
                </ol>
                <Button variant="outline" className="mt-auto h-10 self-start font-semibold" disabled={busy} onClick={() => copyTemplate(t.id)}>
                  Use this paper
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
