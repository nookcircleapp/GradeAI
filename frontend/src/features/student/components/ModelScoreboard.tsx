import type { CSSProperties } from 'react'
import { AlertTriangle, CircuitBoard, Coins, Cpu, Timer, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCount, formatDuration, formatPercent, formatUsd } from '../lib/comparison'
import type { ComparisonSummary, ModelResult, ModelTier } from '../api/student'

interface ModelScoreboardProps {
  results: ModelResult[]
  maxScore: number
  comparison: ComparisonSummary | null
}

/**
 * The headline row: one tile per model, same order everywhere in the report.
 * A model that failed keeps its slot as a contained error tile so the row never
 * collapses and the audience can see exactly which model dropped out.
 */
export function ModelScoreboard({ results, maxScore, comparison }: ModelScoreboardProps) {
  return (
    <div
      className="model-columns gap-4 print:gap-2"
      style={
        {
          '--model-columns': results.length,
          '--model-columns-md': Math.min(2, results.length),
        } as CSSProperties
      }
    >
      {results.map((result) => (
        <ModelScoreTile
          key={result.model_id}
          result={result}
          maxScore={maxScore}
          cheapest={comparison?.cheapest_model_id === result.model_id}
          fastest={comparison?.fastest_model_id === result.model_id}
        />
      ))}
    </div>
  )
}

interface ModelScoreTileProps {
  result: ModelResult
  maxScore: number
  cheapest: boolean
  fastest: boolean
}

function ModelScoreTile({ result, maxScore, cheapest, fastest }: ModelScoreTileProps) {
  if (result.status === 'error') {
    return (
      <div className="avoid-break flex flex-col overflow-hidden rounded-xl border border-dashed border-destructive/50 bg-card shadow-sm">
        <div className="border-b border-dashed border-destructive/40 bg-destructive/[0.04] px-5 py-4">
          <TierTag tier={result.tier} />
          <h3 className="mt-2 text-lg font-bold leading-tight tracking-tight">{result.label}</h3>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{result.model_id}</p>
        </div>
        <div className="flex flex-1 flex-col gap-2 px-5 py-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-bold uppercase tracking-wide text-destructive">
                Grading failed
              </p>
              <p className="break-words text-sm leading-relaxed text-foreground/80">
                {result.error || 'This model returned no result.'}
              </p>
            </div>
          </div>
          <p className="mt-auto pt-2 text-xs text-muted-foreground">
            No scores returned — other models were unaffected.
          </p>
        </div>
      </div>
    )
  }

  const total = result.total_score ?? 0
  const pct = formatPercent(total, maxScore)

  return (
    // A real border rather than a ring: box-shadows are unreliable in print and
    // the tile edge has to survive the PDF export.
    <div className="avoid-break flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-card shadow">
      <div className="flex flex-1 flex-col px-5 pb-4 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
          <TierTag tier={result.tier} />
          {(cheapest || fastest) && (
            <div className="flex flex-wrap justify-end gap-1">
              {cheapest && <RankTag icon={Coins} label="Cheapest run" />}
              {fastest && <RankTag icon={Timer} label="Fastest run" />}
            </div>
          )}
        </div>

        <h3 className="mt-2.5 text-lg font-bold leading-tight tracking-tight text-blue-900">
          {result.label}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{result.model_id}</p>

        {/* The number the room reads from the back of the hall. */}
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <div className="flex items-end gap-1.5">
            <span className="text-6xl font-black leading-[0.85] tracking-tight tabular-nums text-blue-900 print:text-4xl">
              {total}
            </span>
            <span className="pb-0.5 text-xl font-bold tabular-nums text-muted-foreground">
              / {maxScore}
            </span>
          </div>
          <span className="print-exact rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-2xl font-black tabular-nums leading-none text-blue-700 print:text-lg">
            {pct}%
          </span>
        </div>

        <div
          className="print-exact mt-3.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={`${total} out of ${maxScore} marks`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-[width] duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <dl className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11.5px] text-muted-foreground">
        <MetricInline term="Latency" value={formatDuration(result.metrics?.latency_ms)} />
        <Dot />
        <MetricInline term="Tokens" value={formatCount(result.metrics?.total_tokens)} />
        <Dot />
        <MetricInline term="Cost" value={formatUsd(result.metrics?.cost_usd)} />
      </dl>
    </div>
  )
}

function MetricInline({ term, value }: { term: string; value: string }) {
  return (
    <div className="inline-flex items-baseline gap-1">
      <dt className="uppercase tracking-wide">{term}</dt>
      <dd className="font-semibold tabular-nums text-slate-800">{value}</dd>
    </div>
  )
}

function Dot() {
  return (
    <span aria-hidden className="text-slate-300">
      ·
    </span>
  )
}

/**
 * Tier is encoded by weight and shape (filled / outlined / dashed pill) as well
 * as by its word and its icon, so it survives grayscale printing and a
 * washed-out projector — the colour is decoration on top of three colour-free
 * channels.
 *
 * "Local" reads as its own thing rather than as a third shade of the LLM
 * ladder, because that is what it is: no language model at all.
 */
const TIER_TAG: Record<ModelTier, { Icon: typeof Cpu; label: string; className: string }> = {
  large: { Icon: Cpu, label: 'large', className: 'bg-blue-900 text-white' },
  small: {
    Icon: Zap,
    label: 'small',
    className: 'border border-blue-300 bg-blue-50 text-blue-700',
  },
  local: {
    Icon: CircuitBoard,
    label: 'local',
    className: 'border border-dashed border-slate-400 bg-slate-100 text-slate-700',
  },
}

export function TierTag({ tier, className }: { tier: ModelTier; className?: string }) {
  const meta = TIER_TAG[tier] ?? TIER_TAG.small
  const { Icon } = meta
  return (
    <span
      className={cn(
        'print-exact inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]',
        meta.className,
        className
      )}
    >
      <Icon className="size-2.5" />
      {meta.label}
    </span>
  )
}

/** Amber is the design's accent for a figure worth pointing at. The word and the
 *  icon carry the meaning; the colour only draws the eye. */
function RankTag({ icon: Icon, label }: { icon: typeof Coins; label: string }) {
  return (
    <span className="print-exact inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
      <Icon className="size-2.5" />
      {label}
    </span>
  )
}
