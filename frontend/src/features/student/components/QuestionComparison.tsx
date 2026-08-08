import type { CSSProperties } from 'react'
import { ArrowDown, ArrowUp, CheckCheck, Split, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPercent } from '../lib/comparison'
import { TierTag } from './ModelScoreboard'
import type { ModelResult } from '../api/student'
import type { QuestionComparison as QuestionComparisonData } from '../lib/comparison'

interface QuestionComparisonProps {
  questionText: string
  results: ModelResult[]
  data: QuestionComparisonData
}

/** Diagonal hatching for disagreement — a second, colour-free channel that also
 *  survives a grayscale print. Drawn with currentColor so it inherits contrast. */
const HATCH: CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, currentColor 0 3px, transparent 3px 7px)',
}

export function QuestionComparison({ questionText, results, data }: QuestionComparisonProps) {
  const { questionIndex, maxScore, lowest, highest, delta, disagree, comparable } = data

  return (
    <article
      className={cn(
        'avoid-break relative overflow-hidden rounded-xl border bg-card shadow-sm',
        disagree && 'border-foreground/30 shadow-md'
      )}
    >
      {/* Left rail: hatched when the models differ, plain when they agree. */}
      <span
        aria-hidden
        className={cn(
          'print-exact absolute inset-y-0 left-0 w-1.5',
          disagree ? 'text-foreground' : 'bg-border'
        )}
        style={disagree ? HATCH : undefined}
      />

      <header
        className={cn(
          'flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b py-3.5 pl-6 pr-4',
          disagree && 'bg-muted/50'
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums">
            {questionIndex + 1}
          </span>
          <div className="min-w-0">
            <h4 className="text-sm font-bold tracking-tight">Question {questionIndex + 1}</h4>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {maxScore} {maxScore === 1 ? 'mark' : 'marks'} available
            </p>
          </div>
        </div>
        {comparable && <AgreementChip disagree={disagree} delta={delta} />}
      </header>

      <p className="border-b py-3 pl-6 pr-4 text-sm italic leading-relaxed text-muted-foreground">
        {questionText}
      </p>

      <div
        className="model-columns divide-y pl-1.5 sm:divide-x sm:divide-y-0"
        style={
          {
            '--model-columns': results.length,
            '--model-columns-md': Math.min(2, results.length),
          } as CSSProperties
        }
      >
        {results.map((result) => (
          <ModelCell
            key={result.model_id}
            result={result}
            questionIndex={questionIndex}
            maxScore={maxScore}
            lowest={lowest}
            highest={highest}
            disagree={disagree}
          />
        ))}
      </div>
    </article>
  )
}

function AgreementChip({ disagree, delta }: { disagree: boolean; delta: number }) {
  if (!disagree) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        <CheckCheck className="size-3" />
        Models agree
      </span>
    )
  }
  return (
    <span className="print-exact inline-flex items-center gap-1.5 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-background">
      <Split className="size-3" />
      Models differ
      <span aria-hidden className="opacity-60">
        ·
      </span>
      <span className="tabular-nums">
        {delta} {delta === 1 ? 'mark' : 'marks'}
      </span>
    </span>
  )
}

interface ModelCellProps {
  result: ModelResult
  questionIndex: number
  maxScore: number
  lowest: number | null
  highest: number | null
  disagree: boolean
}

function ModelCell({
  result,
  questionIndex,
  maxScore,
  lowest,
  highest,
  disagree,
}: ModelCellProps) {
  const failed = result.status === 'error'
  const grade = result.grades.find((g) => g.question_index === questionIndex)
  const score = grade?.score
  const explanation = grade?.explanation ?? ''

  return (
    <div className="min-w-0 px-4 py-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs font-bold uppercase tracking-wide">{result.label}</span>
        <TierTag tier={result.tier} />
      </div>

      {failed || score === undefined ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-destructive/50 bg-destructive/[0.04] px-3 py-2.5">
          <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-destructive">No grade</p>
            <p className="break-words text-xs leading-relaxed text-foreground/75">
              {result.error || 'This model did not return a score for this question.'}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-2.5 flex items-end gap-2">
            <span
              className={cn(
                'text-4xl font-black leading-none tabular-nums tracking-tight print:text-3xl',
                disagree && 'underline decoration-dotted decoration-2 underline-offset-[6px]'
              )}
            >
              {score}
            </span>
            <span className="pb-0.5 text-base font-bold tabular-nums text-muted-foreground">
              / {maxScore}
            </span>
            {disagree && (score === highest || score === lowest) && (
              <OutlierTag high={score === highest} />
            )}
          </div>

          <div className="print-exact mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/85"
              style={{ width: `${formatPercent(score, maxScore)}%` }}
            />
          </div>

          <p className="mt-3 text-sm leading-relaxed text-foreground/85">{explanation}</p>
        </>
      )}
    </div>
  )
}

/** Direction is carried by an arrow glyph plus a word — never by colour alone. */
function OutlierTag({ high }: { high: boolean }) {
  const Icon = high ? ArrowUp : ArrowDown
  return (
    <span className="mb-1 inline-flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
      <Icon className="size-2.5 stroke-[3]" />
      {high ? 'highest' : 'lowest'}
    </span>
  )
}
