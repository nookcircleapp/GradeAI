import { Coins, Gauge, Info, Scale } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  GRADINGS_PER_BATCH,
  NOT_REPORTED,
  formatCount,
  formatDuration,
  formatRatio,
  formatUsd,
  isOk,
} from '../lib/comparison'
import type { ComparisonSummary, ModelResult } from '../api/student'

interface ComparisonPanelProps {
  comparison: ComparisonSummary
  results: ModelResult[]
  maxScore: number
}

/**
 * The cost argument. Everything here is read straight off the response —
 * the only derived figure is the ×1,000 extrapolation, which is labelled as such.
 */
export function ComparisonPanel({ comparison, results, maxScore }: ComparisonPanelProps) {
  const okResults = results.filter(isOk)
  const labelOf = (id: string | null) =>
    (id ? results.find((r) => r.model_id === id)?.label : null) ?? id ?? 'One model'

  const costRatio = formatRatio(comparison.cost_ratio)
  const speedRatio = formatRatio(comparison.speed_ratio)
  const delta = comparison.max_total_score_delta

  const costs = okResults.map((r) => r.metrics?.cost_usd)
  const latencies = okResults.map((r) => r.metrics?.latency_ms)
  const maxCost = maxFinite(costs)
  const maxLatency = maxFinite(latencies)

  return (
    <Card className="avoid-break gap-0 overflow-hidden rounded-xl border-slate-200 py-0 shadow">
      <CardHeader className="gap-1 bg-gradient-to-r from-blue-900 to-blue-800 px-5 py-4 sm:px-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
          Cost &amp; speed of this grading run
        </p>
        <h3 className="text-xl font-bold tracking-tight text-white">
          What each model charged to reach that grade
        </h3>
      </CardHeader>

      {/* Headline ratios — the three numbers the room should leave with. */}
      <CardContent className="grid gap-px border-b border-slate-200 bg-slate-200 px-0 py-0 sm:grid-cols-3">
        <HeadlineStat
          icon={Coins}
          value={costRatio ? `${costRatio}×` : NOT_REPORTED}
          emphasised={Boolean(costRatio)}
          label="Lower cost"
          detail={
            costRatio
              ? `${labelOf(comparison.cheapest_model_id)} was the cheapest run; the most expensive cost ${costRatio}× as much.`
              : 'At least one model did not report token usage, so no cost ratio can be computed.'
          }
        />
        <HeadlineStat
          icon={Gauge}
          value={speedRatio ? `${speedRatio}×` : NOT_REPORTED}
          emphasised={Boolean(speedRatio)}
          label="Faster"
          detail={
            speedRatio
              ? `${labelOf(comparison.fastest_model_id)} finished first; the slowest run took ${speedRatio}× as long.`
              : 'Latency was not reported for every model.'
          }
        />
        <HeadlineStat
          icon={Scale}
          value={delta === null ? NOT_REPORTED : `${delta}`}
          emphasised={delta !== null}
          label={delta === 1 ? 'Mark apart' : 'Marks apart'}
          detail={
            delta === null
              ? 'The score spread across models was not reported.'
              : `Widest gap between any two model totals, out of ${maxScore}.`
          }
        />
      </CardContent>

      {/* Relative bars — length carries the comparison, labels carry the value. */}
      <CardContent className="grid gap-6 bg-card px-5 py-5 sm:px-6 lg:grid-cols-2">
        <BarGroup
          title="Cost of this run"
          caption="Bar length is relative to the most expensive model."
          rows={okResults.map((r) => ({
            key: r.model_id,
            label: r.label,
            raw: r.metrics?.cost_usd,
            display: formatUsd(r.metrics?.cost_usd),
            fraction: fraction(r.metrics?.cost_usd, maxCost),
          }))}
        />
        <BarGroup
          title="Time to grade"
          caption="Bar length is relative to the slowest model."
          rows={okResults.map((r) => ({
            key: r.model_id,
            label: r.label,
            raw: r.metrics?.latency_ms,
            display: formatDuration(r.metrics?.latency_ms),
            fraction: fraction(r.metrics?.latency_ms, maxLatency),
          }))}
        />
      </CardContent>

      {/* Raw numbers, including the clearly-labelled extrapolation. */}
      <CardContent className="border-t border-slate-200 bg-slate-50 px-5 py-5 sm:px-6">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Per model
        </p>
        <div className="space-y-2.5">
          {okResults.map((result) => (
            <div
              key={result.model_id}
              className="avoid-break rounded-xl border border-slate-200 bg-card px-4 py-3.5 shadow-sm"
            >
              <p className="text-sm font-bold text-blue-900">{result.label}</p>
              <dl className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
                <Stat term="Latency" value={formatDuration(result.metrics?.latency_ms)} />
                <Stat
                  term="Tokens (in / out)"
                  value={`${formatCount(result.metrics?.prompt_tokens)} / ${formatCount(
                    result.metrics?.completion_tokens
                  )}`}
                />
                <Stat term="Cost, this paper" value={formatUsd(result.metrics?.cost_usd)} />
                <Stat
                  term={`Cost × ${GRADINGS_PER_BATCH.toLocaleString('en-US')} papers`}
                  value={formatUsd(scale(result.metrics?.cost_usd, GRADINGS_PER_BATCH))}
                  emphasised
                />
              </dl>
            </div>
          ))}
        </div>

        {/* The honesty note. Deliberately not fine print: a scientific audience
            has to be able to read the caveat from the same distance as the
            headline it qualifies. */}
        <div className="print-exact mt-4 flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5">
          <Info className="mt-0.5 size-4 shrink-0 text-blue-700" />
          <p className="text-[13px] leading-relaxed text-blue-900/85">
            The final column is this run&rsquo;s measured cost multiplied by{' '}
            <span className="font-bold tabular-nums text-blue-900">
              {GRADINGS_PER_BATCH.toLocaleString('en-US')}
            </span>{' '}
            — an extrapolation shown only to make fractions of a cent readable. It assumes papers of
            the same length. Where a provider did not return token usage, cost is shown as
            &ldquo;{NOT_REPORTED}&rdquo; rather than estimated.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function maxFinite(values: Array<number | null | undefined>): number | null {
  const finite = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return finite.length > 0 ? Math.max(...finite) : null
}

function fraction(value: number | null | undefined, max: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (max === null || max <= 0) return null
  return value / max
}

function scale(value: number | null | undefined, factor: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value * factor : null
}

interface HeadlineStatProps {
  icon: typeof Coins
  value: string
  label: string
  detail: string
  emphasised: boolean
}

function HeadlineStat({ icon: Icon, value, label, detail, emphasised }: HeadlineStatProps) {
  return (
    <div className="avoid-break bg-card px-5 py-5 sm:px-6">
      <div className="flex items-center gap-1.5 text-blue-700">
        <Icon className="size-3.5" />
        <span className="text-[11px] font-bold uppercase tracking-[0.16em]">{label}</span>
      </div>
      <p
        className={cn(
          'mt-2 font-black leading-none tracking-tight tabular-nums',
          emphasised
            ? 'text-5xl text-blue-900 sm:text-6xl print:text-3xl'
            : 'text-lg font-semibold italic text-muted-foreground'
        )}
      >
        {value}
      </p>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  )
}

interface BarRow {
  key: string
  label: string
  raw: number | null | undefined
  display: string
  fraction: number | null
}

function BarGroup({
  title,
  caption,
  rows,
}: {
  title: string
  caption: string
  rows: BarRow[]
}) {
  return (
    <section className="avoid-break space-y-3">
      <div>
        <h4 className="text-sm font-bold tracking-tight text-blue-900">{title}</h4>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-1 sm:grid-cols-[minmax(0,9rem)_1fr_minmax(0,5.5rem)] sm:items-center sm:gap-3"
          >
            <span className="truncate text-xs font-semibold text-slate-700">{row.label}</span>
            <div className="print-exact h-4 w-full overflow-hidden rounded-sm bg-slate-100">
              {row.fraction !== null && (
                <div
                  className="h-full rounded-sm bg-gradient-to-r from-blue-600 to-blue-400 transition-[width] duration-700 ease-out"
                  style={{ width: `${Math.max(row.fraction * 100, 1.5)}%` }}
                />
              )}
            </div>
            <span
              className={cn(
                'text-[13px] font-bold tabular-nums text-blue-900 sm:text-right',
                row.raw == null && 'text-xs font-medium italic text-muted-foreground'
              )}
            >
              {row.display}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Stat({
  term,
  value,
  emphasised = false,
}: {
  term: string
  value: string
  emphasised?: boolean
}) {
  const missing = value === NOT_REPORTED
  return (
    <div className="min-w-0">
      <dt
        className={cn(
          'text-[10px] font-bold uppercase tracking-wider',
          emphasised ? 'text-amber-700' : 'text-muted-foreground'
        )}
      >
        {term}
      </dt>
      <dd
        className={cn(
          'mt-0.5 truncate tabular-nums',
          emphasised ? 'text-xl font-black text-amber-600' : 'text-sm font-bold text-slate-800',
          missing && 'text-sm font-medium italic text-muted-foreground'
        )}
      >
        {value}
      </dd>
    </div>
  )
}
