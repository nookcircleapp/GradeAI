import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { QuestionGrade } from './QuestionGrade'
import { TierTag } from './ModelScoreboard'
import { formatCount, formatDuration, formatPercent, formatUsd } from '../lib/comparison'
import type { ModelResult } from '../api/student'

interface Question {
  text: string
  credit: number
  min_words: number
  rubric: string[]
}

interface SingleModelReportProps {
  result: ModelResult
  maxScore: number
  questions: Question[]
}

function getOverallTier(score: number, maxScore: number): 'excellent' | 'good' | 'fair' | 'poor' {
  const pct = maxScore > 0 ? score / maxScore : 0
  if (pct >= 0.85) return 'excellent'
  if (pct >= 0.65) return 'good'
  if (pct >= 0.4) return 'fair'
  return 'poor'
}

// Light-only, like the rest of the app: the `dark:` halves these entries used to
// carry could never fire (globals.css defines no `.dark` palette and nothing sets
// the class) and have been removed rather than left as decoration.
const tierStyles = {
  excellent: {
    ring: 'ring-emerald-400/60',
    fill: 'text-emerald-600',
    bg: 'bg-emerald-50',
    bar: 'bg-gradient-to-r from-emerald-400 to-emerald-500',
    label: 'Excellent',
    labelClass: 'border-emerald-300/60 bg-emerald-500/15 text-emerald-700',
  },
  good: {
    ring: 'ring-blue-400/60',
    fill: 'text-blue-700',
    bg: 'bg-blue-50',
    bar: 'bg-gradient-to-r from-blue-600 to-blue-400',
    label: 'Good',
    labelClass: 'border-blue-300/60 bg-blue-500/15 text-blue-700',
  },
  fair: {
    ring: 'ring-amber-400/60',
    fill: 'text-amber-600',
    bg: 'bg-amber-50',
    bar: 'bg-gradient-to-r from-amber-400 to-amber-500',
    label: 'Needs Work',
    labelClass: 'border-amber-300/60 bg-amber-500/15 text-amber-700',
  },
  poor: {
    ring: 'ring-red-400/60',
    fill: 'text-red-600',
    bg: 'bg-red-50',
    bar: 'bg-gradient-to-r from-red-400 to-red-500',
    label: 'Below Standard',
    labelClass: 'border-red-300/60 bg-red-500/15 text-red-700',
  },
}

/**
 * One model only — the classic single-column report, kept intact so the
 * comparison work never degrades the ordinary grading experience.
 */
export function SingleModelReport({ result, maxScore, questions }: SingleModelReportProps) {
  if (result.status === 'error') {
    return (
      <Card className="avoid-break border-destructive/50">
        <CardContent className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-destructive">
              {result.label} could not grade this paper
            </p>
            <p className="text-sm text-foreground/80">
              {result.error || 'The model returned no result.'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalScore = result.total_score ?? 0
  const pct = formatPercent(totalScore, maxScore)
  const styles = tierStyles[getOverallTier(totalScore, maxScore)]

  return (
    <div className="space-y-6">
      <Card className={cn('avoid-break overflow-hidden border-0 shadow-md ring-2', styles.ring, styles.bg)}>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TierTag tier={result.tier} />
              <span className="text-sm font-semibold">{result.label}</span>
            </div>
            <Badge
              variant="outline"
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold',
                styles.labelClass
              )}
            >
              {styles.label}
            </Badge>
          </div>

          <div className="flex items-end gap-3">
            <span className={cn('text-6xl font-black leading-none tabular-nums', styles.fill)}>
              {totalScore}
            </span>
            <div className="space-y-0.5 pb-1">
              <span className="text-2xl font-bold text-muted-foreground">/ {maxScore}</span>
              <p className="text-xs font-medium text-muted-foreground">marks</p>
            </div>
            <div className="ml-auto pb-1 text-right">
              <p className={cn('text-3xl font-black tabular-nums', styles.fill)}>{pct}%</p>
              <p className="text-xs font-medium text-muted-foreground">percentage</p>
            </div>
          </div>

          <div className="print-exact h-3 w-full overflow-hidden rounded-full bg-background/80 shadow-inner">
            <div
              className={cn('h-full rounded-full transition-all duration-700 ease-out', styles.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>

          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
            <Metric term="Latency" value={formatDuration(result.metrics?.latency_ms)} />
            <Metric term="Tokens" value={formatCount(result.metrics?.total_tokens)} />
            <Metric term="Cost" value={formatUsd(result.metrics?.cost_usd)} />
          </dl>
        </CardContent>
      </Card>

      {result.grades.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Question Breakdown
          </h3>
          <div className="space-y-3">
            {result.grades.map((grade) => (
              <div key={grade.question_index} className="avoid-break">
                <QuestionGrade
                  questionIndex={grade.question_index}
                  questionText={questions[grade.question_index]?.text ?? ''}
                  score={grade.score}
                  maxScore={grade.max_score}
                  explanation={grade.explanation}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Metric({ term, value }: { term: string; value: string }) {
  return (
    <div className="inline-flex items-baseline gap-1">
      <dt className="uppercase tracking-wide">{term}</dt>
      <dd className="font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  )
}
