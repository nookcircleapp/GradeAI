import { useEffect, useState } from 'react'
import { Crown, Link2 } from 'lucide-react'
import { toast } from 'sonner'

import { Wordmark } from './components/Brand'
import { Spinner } from './components/Spinner'
import { student, type LeaderboardEntry, type WinnersPage as Winners } from './api'
import { errorMessage, formatDate, initials, winnersLink } from './format'

const PODIUM = [
  { place: 2, height: 'h-36', block: 'bg-slate-400 text-blue-950', avatar: 'size-18 bg-slate-300 text-2xl', order: 'order-1' },
  { place: 1, height: 'h-52', block: 'bg-amber-500 text-blue-950', avatar: 'size-24 bg-amber-300 text-3xl ring-[6px] ring-amber-300/25', order: 'order-2' },
  { place: 3, height: 'h-24', block: 'bg-orange-700 text-white', avatar: 'size-18 bg-orange-300 text-2xl', order: 'order-3' },
]

function Podium({ entries, max }: { entries: LeaderboardEntry[]; max: number }) {
  return (
    <div className="flex flex-wrap items-end justify-center gap-4">
      {PODIUM.map(({ place, height, block, avatar, order }) => {
        const entry = entries[place - 1]
        if (!entry) return null
        const winner = place === 1
        return (
          <div key={place} className={`flex w-full max-w-60 flex-col items-center gap-2.5 sm:w-auto sm:flex-[0_1_220px] ${order}`}>
            {winner && <Crown className="size-10 text-amber-300" aria-hidden="true" />}
            <div className={`flex items-center justify-center rounded-full font-extrabold text-blue-950 ${avatar}`}>
              {initials(entry.student_name)}
            </div>
            <div className={`text-center font-bold ${winner ? 'text-[22px] font-extrabold' : 'text-lg'}`}>{entry.student_name}</div>
            <div className={winner ? 'font-semibold text-amber-200' : 'text-sm text-slate-300'}>
              {entry.score} / {max}
              {winner ? ' · Winner' : ''}
            </div>
            <div
              className={`flex w-full items-start justify-center rounded-t-xl pt-4 font-extrabold ${height} ${block} ${
                winner ? 'text-5xl' : 'text-4xl'
              }`}
            >
              {place}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** /w/:code — the shareable winners screen for a paper. */
export function WinnersPage({ code }: { code: string }) {
  const [data, setData] = useState<Winners | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    student.winners(code).then(setData).catch((e) => setError(errorMessage(e)))
  }, [code])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(winnersLink(code))
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <div className="min-h-[calc(100vh-28px)] bg-[#0B1B4D] text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pb-12 pt-8">
        <div className="flex flex-wrap items-center gap-3">
          <Wordmark inverted />
          <span className="ml-auto hidden text-sm text-slate-300 sm:inline">{winnersLink(code).replace(/^https?:\/\//, '')}</span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#3B4F8C] px-4 font-semibold hover:bg-white/5"
          >
            <Link2 className="size-4" aria-hidden="true" /> Copy link
          </button>
        </div>

        {error ? (
          <div className="py-24 text-center">
            <h1 className="text-3xl font-extrabold">Winners are not announced yet</h1>
            <p className="mt-2 text-slate-300">Check back after your teacher closes the paper.</p>
          </div>
        ) : !data ? (
          <Spinner label="Loading results" />
        ) : (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-amber-300">Results</span>
              <h1 className="text-4xl font-extrabold leading-tight sm:text-[44px]">{data.title}</h1>
              <div className="text-slate-300">
                {[data.subject, `${data.participants} student${data.participants === 1 ? '' : 's'} took part`, `graded by ${data.grading_model}`, formatDate(data.date)]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>

            {data.entries.length ? <Podium entries={data.entries} max={data.max_score} /> : <p className="text-center text-slate-300">No graded submissions.</p>}

            {data.entries.length > 3 && (
              <section className="mx-auto flex w-full max-w-2xl flex-col rounded-2xl bg-[#13286B] p-5">
                <h2 className="mb-2 font-bold">Full leaderboard</h2>
                {data.entries.slice(3).map((e) => (
                  <div key={e.rank} className="flex items-center gap-3 border-t border-[#23397E] py-2.5">
                    <span className="w-8 font-bold text-slate-300">{e.rank}</span>
                    <span className="flex-1">
                      {e.student_name}
                      {e.roll_number && <span className="ml-2 text-sm text-slate-400">{e.roll_number}</span>}
                    </span>
                    <span className="font-bold tabular-nums">{e.score}</span>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
