import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Link } from '../components/Link'
import { ErrorNote, Spinner } from '../components/Spinner'
import { models as modelsApi, papers, type ModelInfo, type Paper, type PaperFields, type Question } from '../api'
import { errorMessage, studentLink, winnersLink } from '../format'
import { navigate } from '../router'
import { STATUS_LABEL, STATUS_STYLE } from './status'

const FIELD = 'h-10 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-blue-700'
const AREA = 'rounded-lg border border-slate-300 bg-white p-2.5 text-sm outline-none focus:border-blue-700 resize-y'
const TIME_LIMITS = [null, 15, 20, 30, 40, 45, 60, 90, 120, 180]

type Draft = PaperFields

function toDraft(p: Paper): Draft {
  return {
    title: p.title,
    subject: p.subject,
    instructions: p.instructions,
    questions: p.questions.map((q) => ({ ...q, rubric: [...q.rubric] })),
    time_limit_minutes: p.time_limit_minutes,
    opens_at: p.opens_at,
    closes_at: p.closes_at,
    collect_section: p.collect_section,
    results_mode: p.results_mode,
    allow_preview: p.allow_preview,
    is_contest: p.is_contest,
    hide_roll_numbers_on_winners: p.hide_roll_numbers_on_winners,
    grading_model: p.grading_model,
  }
}

function problems(draft: Draft): string[] {
  const out: string[] = []
  if (!draft.title.trim()) out.push('Give the paper a title.')
  if (!draft.questions.length) out.push('Add at least one question.')
  draft.questions.forEach((q, i) => {
    if (!q.text.trim()) out.push(`Question ${i + 1} has no text.`)
    if (!(q.marks >= 1)) out.push(`Question ${i + 1} needs marks of at least 1.`)
  })
  return out
}

/** /t/papers/:id — set a paper, publish it, and share the join code. */
export function PaperEditor({ id }: { id: number }) {
  const [paper, setPaper] = useState<Paper | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [modelList, setModelList] = useState<ModelInfo[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    papers
      .get(id)
      .then((p) => {
        setPaper(p)
        setDraft(toDraft(p))
      })
      .catch((e) => setError(errorMessage(e)))
    modelsApi
      .list()
      .then((list) => setModelList(list.filter((m) => m.tier !== 'local')))
      .catch(() => undefined)
  }, [id])

  const dirty = useMemo(() => paper && draft && JSON.stringify(toDraft(paper)) !== JSON.stringify(draft), [paper, draft])

  if (error) return <div className="mx-auto max-w-6xl p-6"><ErrorNote message={error} /></div>
  if (!paper || !draft) return <Spinner />

  const locked = paper.submission_count > 0
  const total = draft.questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0)
  const issues = problems(draft)

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const setQ = (i: number, patch: Partial<Question>) =>
    set({ questions: draft.questions.map((q, j) => (j === i ? { ...q, ...patch } : q)) })
  const moveQ = (i: number, by: number) => {
    const qs = [...draft.questions]
    const [q] = qs.splice(i, 1)
    qs.splice(i + by, 0, q)
    set({ questions: qs })
    setOpen(i + by)
  }

  const save = async (): Promise<Paper | null> => {
    if (issues.length) {
      toast.error(issues[0])
      return null
    }
    setBusy(true)
    try {
      const body: Partial<Draft> = { ...draft }
      if (locked) delete body.questions
      const saved = await papers.update(id, body)
      setPaper(saved)
      setDraft(toDraft(saved))
      toast.success('Saved')
      return saved
    } catch (e) {
      toast.error(errorMessage(e))
      return null
    } finally {
      setBusy(false)
    }
  }

  const setStatus = async (status: Paper['status']) => {
    if (dirty && !(await save())) return
    setBusy(true)
    try {
      const updated = await papers.setStatus(id, status)
      setPaper(updated)
      toast.success(status === 'open' ? 'Published. Share the code with your class.' : status === 'closed' ? 'Paper closed' : 'Moved back to draft')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    try {
      await papers.remove(id)
      navigate('/t', true)
    } catch (e) {
      toast.error(errorMessage(e))
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(studentLink(paper.share_code))
      toast.success('Student link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-start gap-6 p-6">
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <Link href="/t" className="text-blue-700 no-underline hover:underline">Papers</Link>
          <span>/</span>
          <span className="truncate">{paper.title}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[paper.status]}`}>{STATUS_LABEL[paper.status]}</span>
          <span className="ml-auto text-[13px]">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        </div>

        <section className="flex flex-col gap-3 rounded-xl border border-t-[6px] border-slate-200 border-t-blue-700 bg-white p-6">
          <label htmlFor="title" className="text-xs font-semibold uppercase tracking-wider text-slate-600">Paper title</label>
          <input
            id="title"
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            className="border-b-2 border-slate-200 py-1 text-[26px] font-bold outline-none focus:border-blue-700"
          />
          <textarea
            aria-label="Instructions for students"
            placeholder="Instructions for students"
            rows={2}
            value={draft.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            className="resize-y text-[15px] text-slate-600 outline-none"
          />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3 pt-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="subject" className="text-[13px] font-semibold">Class / subject</label>
              <input id="subject" value={draft.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="Civil Engg · Sem 5" className={FIELD} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="time" className="text-[13px] font-semibold">Time limit</label>
              <select
                id="time"
                value={draft.time_limit_minutes ?? ''}
                onChange={(e) => set({ time_limit_minutes: e.target.value ? Number(e.target.value) : null })}
                className={FIELD}
              >
                {TIME_LIMITS.map((m) => (
                  <option key={m ?? 'none'} value={m ?? ''}>{m ? `${m} minutes` : 'No limit'}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="model" className="text-[13px] font-semibold">Grading model</label>
              <select
                id="model"
                value={draft.grading_model ?? ''}
                onChange={(e) => set({ grading_model: e.target.value || null })}
                className={FIELD}
              >
                <option value="">Default (GPT-4o mini)</option>
                {modelList.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                    {m.available ? '' : ' (no API key)'}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="results" className="text-[13px] font-semibold">Students see result</label>
              <select
                id="results"
                value={draft.results_mode}
                onChange={(e) => set({ results_mode: e.target.value as Draft['results_mode'] })}
                className={FIELD}
              >
                <option value="immediate">Right after submit</option>
                <option value="on_release">When I release them</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1 text-sm">
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
              <input type="checkbox" checked={draft.collect_section} onChange={(e) => set({ collect_section: e.target.checked })} className="size-4 accent-blue-700" />
              Ask students for class / section
            </label>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2">
              <input type="checkbox" checked={draft.allow_preview} onChange={(e) => set({ allow_preview: e.target.checked })} className="size-4 accent-blue-700" />
              Let students try an answer before submitting
            </label>
          </div>
        </section>

        <section className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-5 py-4">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={draft.is_contest} onChange={(e) => set({ is_contest: e.target.checked })} className="size-4 accent-blue-700" />
            Winners screen
          </label>
          <p className="-mt-1 pl-6 text-sm text-slate-600">Ranks students by score and gives you a shareable results page once you close the paper.</p>
          {draft.is_contest && (
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 pl-6 text-sm">
              <input
                type="checkbox"
                checked={draft.hide_roll_numbers_on_winners}
                onChange={(e) => set({ hide_roll_numbers_on_winners: e.target.checked })}
                className="size-4 accent-blue-700"
              />
              Hide roll numbers on the winners screen
            </label>
          )}
        </section>

        {locked && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Questions are locked because {paper.submission_count} student{paper.submission_count === 1 ? ' has' : 's have'} started this paper. Copy the paper to change them.
          </div>
        )}

        {draft.questions.map((q, i) =>
          open === i && !locked ? (
            <section key={i} className="flex flex-col gap-3.5 rounded-xl border-2 border-blue-700 bg-white p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13px] font-bold text-blue-700">Q{i + 1}</span>
                <textarea
                  aria-label={`Question ${i + 1}`}
                  placeholder="Type the question"
                  rows={2}
                  value={q.text}
                  onChange={(e) => setQ(i, { text: e.target.value })}
                  className="min-w-0 flex-[1_1_320px] resize-y rounded-lg bg-slate-50 p-3 text-[17px] font-semibold outline-none focus:ring-2 focus:ring-blue-200"
                />
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  Marks
                  <input type="number" min={1} max={100} value={q.marks} onChange={(e) => setQ(i, { marks: Number(e.target.value) })} className="h-10 w-16 rounded-lg border border-slate-300 text-center" />
                </label>
                <label className="flex items-center gap-1.5 text-sm text-slate-600">
                  Min words
                  <input type="number" min={0} max={5000} value={q.min_words} onChange={(e) => setQ(i, { min_words: Number(e.target.value) })} className="h-10 w-20 rounded-lg border border-slate-300 text-center" />
                </label>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`ref${i}`} className="text-[13px] font-semibold">Reference answer</label>
                  <textarea id={`ref${i}`} rows={6} value={q.reference_answer} onChange={(e) => setQ(i, { reference_answer: e.target.value })} className={AREA} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`rub${i}`} className="text-[13px] font-semibold">Rubric (one point per line)</label>
                  <textarea
                    id={`rub${i}`}
                    rows={6}
                    value={q.rubric.join('\n')}
                    onChange={(e) => setQ(i, { rubric: e.target.value.split('\n') })}
                    className={AREA}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => moveQ(i, -1)}><ArrowUp className="size-4" aria-hidden="true" /> Move up</Button>
                <Button variant="ghost" size="sm" disabled={i === draft.questions.length - 1} onClick={() => moveQ(i, 1)}><ArrowDown className="size-4" aria-hidden="true" /> Move down</Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto text-red-700 hover:bg-red-50 hover:text-red-800"
                  disabled={draft.questions.length === 1}
                  onClick={() => {
                    set({ questions: draft.questions.filter((_, j) => j !== i) })
                    setOpen(Math.max(0, i - 1))
                  }}
                >
                  <Trash2 className="size-4" aria-hidden="true" /> Remove
                </Button>
              </div>
            </section>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(i)}
              disabled={locked}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 text-left enabled:hover:border-blue-300 disabled:cursor-default"
            >
              <span className="text-[13px] font-bold text-slate-600">Q{i + 1}</span>
              <span className="flex-[1_1_300px] font-semibold">{q.text || <em className="font-normal text-slate-500">Empty question</em>}</span>
              <span className="text-sm text-slate-600">{q.marks} marks</span>
            </button>
          )
        )}
        {!locked && (
          <button
            type="button"
            onClick={() => {
              set({ questions: [...draft.questions, { text: '', marks: 5, min_words: 0, rubric: [], reference_answer: '' }] })
              setOpen(draft.questions.length)
            }}
            className="min-h-11 self-start rounded-xl border border-dashed border-slate-400 px-4 font-semibold text-blue-700 hover:bg-white"
          >
            + Add question
          </button>
        )}
      </main>

      <aside className="sticky top-20 flex flex-[1_1_300px] flex-col gap-4">
        <section className="flex flex-col gap-3.5 rounded-xl border border-slate-200 bg-white p-5">
          <div className="font-bold">{paper.status === 'draft' ? 'Ready to run' : paper.status === 'open' ? 'Paper is live' : 'Paper is closed'}</div>
          <div className="flex justify-between text-sm text-slate-600"><span>Questions</span><span className="font-semibold text-slate-900">{draft.questions.length}</span></div>
          <div className="flex justify-between text-sm text-slate-600"><span>Total marks</span><span className="font-semibold text-slate-900">{total}</span></div>
          <div className="flex justify-between text-sm text-slate-600"><span>Students started</span><span className="font-semibold text-slate-900">{paper.submission_count}</span></div>
          <Button variant="outline" className="h-11 font-semibold" disabled={busy || !dirty} onClick={save}>
            Save changes
          </Button>
          {paper.status === 'draft' && (
            <Button className="h-12 font-bold" disabled={busy || issues.length > 0} onClick={() => setStatus('open')}>
              Publish and get join code
            </Button>
          )}
          {paper.status === 'open' && (
            <Button variant="outline" className="h-11 font-semibold" disabled={busy} onClick={() => setStatus('closed')}>
              Close paper
            </Button>
          )}
          {paper.status === 'closed' && (
            <Button variant="outline" className="h-11 font-semibold" disabled={busy} onClick={() => setStatus('open')}>
              Reopen paper
            </Button>
          )}
          <Link href={`/t/papers/${id}/records`} className="text-center text-sm font-semibold text-blue-700 no-underline hover:underline">
            View records
          </Link>
          {paper.status === 'draft' && paper.submission_count === 0 && (
            <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-red-700 hover:underline">
              Delete paper
            </button>
          )}
        </section>

        {paper.status !== 'draft' && (
          <section className="flex flex-col items-center gap-2.5 rounded-xl bg-slate-900 p-5 text-center text-white">
            <div className="text-[13px] text-slate-300">Students open</div>
            <div className="font-semibold">{window.location.host}</div>
            <div className="text-[13px] text-slate-300">and type the code</div>
            <div className="font-mono text-[40px] font-bold tracking-[0.12em] text-amber-300">{paper.share_code}</div>
            <button type="button" onClick={copyLink} className="text-sm font-semibold text-amber-200 underline">
              Copy direct link
            </button>
            <div className="text-[13px] text-slate-300">Project this on the classroom screen</div>
          </section>
        )}
        {paper.is_contest && paper.winners_revealed && (
          <a href={winnersLink(paper.share_code)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-blue-700">
            Open winners screen <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        )}
      </aside>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this paper?</DialogTitle>
            <DialogDescription>This removes the draft and its questions. It can't be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="danger-ghost" onClick={remove}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
