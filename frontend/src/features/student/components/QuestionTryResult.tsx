import { useState } from 'react'
import { AlertCircle, ChevronDown, Coins, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { QuestionComparison } from './QuestionComparison'
import {
  NOT_REPORTED,
  buildQuestionComparison,
  formatCount,
  formatDuration,
  formatRatio,
  formatUsd,
  isOk,
  orderResults,
  remapResultsToQuestions,
} from '../lib/comparison'
import type { GradingResponse, ModelResult } from '../api/student'

/**
 * One question's own Try. Kept per question index in the student view so trying
 * Q2 never disturbs Q1, and so a re-try keeps the previous marks on screen until
 * the new ones land.
 */
export interface QuestionTryState {
  /** True while this question's own request is in flight. */
  pending: boolean
  /** Last result for this question. Survives a later Try on another question. */
  response: GradingResponse | null
  /** Request-level failure: every model failed, or the call never landed. */
  error: string | null
}

interface QuestionTryResultProps {
  questionIndex: number
  /** The exam's mark allocation, used only if no model reported a max_score. */
  credit: number
  state: QuestionTryState
}

/**
 * The inline result of a single-question Try: each model's score out of that
 * question's marks and its explanation, and nothing else. Cost, latency and
 * token counts are real and worth showing, but they are the demo's argument
 * rather than the student's feedback, so they sit behind a closed disclosure.
 */
export function QuestionTryResult({ questionIndex, credit, state }: QuestionTryResultProps) {
  const { pending, response, error } = state

  const results = response
    ? orderResults(remapResultsToQuestions(response.results, [questionIndex]))
    : []
  const data = response ? buildQuestionComparison(results, questionIndex, credit) : null

  if (!pending && !error && results.length === 0) return null

  return (
    <div className="space-y-3">
      {pending && (
        <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <Loader2 className="size-4 shrink-0 animate-spin text-blue-700" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-blue-900">Grading this answer…</span>{' '}
            {response ? 'The marks below are from your previous try.' : 'This takes a few seconds.'}
          </p>
        </div>
      )}

      {error && !pending && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-destructive">Could not grade this answer</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{error}</p>
          </div>
        </div>
      )}

      {response && data && results.length > 0 && (
        // Dimmed while a re-try is running, so stale marks never read as fresh.
        <div className={cn('space-y-2', pending && 'opacity-60')}>
          <QuestionComparison results={results} data={data} showAgreement={false} />
          <CostDisclosure response={response} results={results} />
        </div>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

interface CostDisclosureProps {
  response: GradingResponse
  results: ModelResult[]
}

/**
 * Collapsed by default. Mirrors the "Marking criteria" toggle already used on
 * the question card rather than introducing a new disclosure pattern.
 */
function CostDisclosure({ response, results }: CostDisclosureProps) {
  const [open, setOpen] = useState(false)
  const okResults = results.filter(isOk)
  if (okResults.length === 0) return null

  const costRatio = formatRatio(response.comparison?.cost_ratio)
  const speedRatio = formatRatio(response.comparison?.speed_ratio)

  return (
    <div className="overflow-hidden rounded-lg border bg-muted/70">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] font-semibold text-blue-700 transition-colors hover:bg-blue-50"
      >
        <Coins className="size-3.5 shrink-0" />
        <span className="flex-1">Cost &amp; speed of this try</span>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-border/70 px-4 pb-3 pt-2.5">
          {(costRatio || speedRatio) && (
            <p className="text-xs text-muted-foreground">
              {costRatio && (
                <>
                  <span className="font-bold tabular-nums text-blue-900">{costRatio}×</span> cost
                  spread
                </>
              )}
              {costRatio && speedRatio && <span aria-hidden> · </span>}
              {speedRatio && (
                <>
                  <span className="font-bold tabular-nums text-blue-900">{speedRatio}×</span> speed
                  spread
                </>
              )}
            </p>
          )}
          <dl className="space-y-2">
            {okResults.map((result) => (
              <div key={result.model_id} className="min-w-0">
                <dt className="text-xs font-bold text-slate-700">{result.label}</dt>
                <dd className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs tabular-nums text-muted-foreground">
                  <Figure term="Latency" value={formatDuration(result.metrics?.latency_ms)} />
                  <Figure
                    term="Tokens"
                    value={`${formatCount(result.metrics?.prompt_tokens)} in / ${formatCount(
                      result.metrics?.completion_tokens
                    )} out`}
                  />
                  <Figure term="Cost" value={formatUsd(result.metrics?.cost_usd)} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Measured on this request. A figure the provider did not return reads &ldquo;
            {NOT_REPORTED}&rdquo; rather than being estimated.
          </p>
        </div>
      )}
    </div>
  )
}

function Figure({ term, value }: { term: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="uppercase tracking-wide">{term}</span>
      <span
        className={cn(
          'font-semibold text-slate-800',
          value === NOT_REPORTED && 'font-medium italic text-muted-foreground'
        )}
      >
        {value}
      </span>
    </span>
  )
}
