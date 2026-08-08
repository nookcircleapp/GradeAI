import type { CSSProperties } from 'react'
import { AlertTriangle, Coins, Cpu, Timer, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCount, formatDuration, formatPercent, formatUsd } from '../lib/comparison'
import type { ComparisonSummary, ModelResult } from '../api/student'

interface ModelScoreboardProps {
  results: ModelResult[]
  maxScore: number
  comparison: ComparisonSummary | null
}

/**
 * The headline row: one tile per model, same order everywhere in the report.
 * A model that failed keeps its slot as a contained error tile so the row never
 * collapses and the audience can see exactly which provider dropped out.
 */
export function ModelScoreboard({ results, maxScore, comparison }: ModelScoreboardProps) {
  return (
    <div
      className="model-columns gap-3 print:gap-2"
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
      <div className="avoid-break flex flex-col rounded-xl border border-dashed border-destructive/50 bg-destructive/[0.04] p-5">
        <TierTag tier={result.tier} />
        <h3 className="mt-2 text-lg font-semibold leading-tight">{result.label}</h3>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{result.model_id}</p>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-background/60 p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-bold uppercase tracking-wide text-destructive">
              Grading failed
            </p>
            <p className="break-words text-sm text-foreground/80">
              {result.error || 'This model returned no result.'}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          No scores returned — other models were unaffected.
        </p>
      </div>
    )
  }

  const total = result.total_score ?? 0
  const pct = formatPercent(total, maxScore)

  return (
    <div className="avoid-break flex flex-col rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <TierTag tier={result.tier} />
        {(cheapest || fastest) && (
          <div className="flex flex-wrap justify-end gap-1">
            {cheapest && <RankTag icon={Coins} label="Cheapest run" />}
            {fastest && <RankTag icon={Timer} label="Fastest run" />}
          </div>
        )}
      </div>

      <h3 className="mt-2 text-lg font-semibold leading-tight tracking-tight">{result.label}</h3>
      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{result.model_id}</p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex items-end gap-1.5">
          <span className="text-6xl font-black leading-[0.85] tabular-nums tracking-tight print:text-4xl">
            {total}
          </span>
          <span className="pb-0.5 text-xl font-bold text-muted-foreground tabular-nums">
            / {maxScore}
          </span>
        </div>
        <span className="pb-0.5 text-2xl font-black tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </div>

      <div
        className="print-exact mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${total} out of ${maxScore} marks`}
      >
        <div
          className="h-full rounded-full bg-foreground/85 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <dl className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-xs text-muted-foreground">
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
      <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}

function Dot() {
  return (
    <span aria-hidden className="text-muted-foreground/40">
      ·
    </span>
  )
}

/**
 * Tier is encoded by weight and shape (filled vs outlined pill) as well as by
 * its word, so it survives grayscale printing.
 */
export function TierTag({ tier, className }: { tier: 'large' | 'small'; className?: string }) {
  const Icon = tier === 'large' ? Cpu : Zap
  return (
    <span
      className={cn(
        'print-exact inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]',
        tier === 'large'
          ? 'bg-foreground text-background'
          : 'border border-foreground/40 text-foreground',
        className
      )}
    >
      <Icon className="size-2.5" />
      {tier}
    </span>
  )
}

function RankTag({ icon: Icon, label }: { icon: typeof Coins; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-2.5" />
      {label}
    </span>
  )
}
