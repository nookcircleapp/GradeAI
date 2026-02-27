import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy, Eye, CheckCircle, Sparkles } from 'lucide-react'
import { QuestionGrade } from './QuestionGrade'
import type { GradeResult } from '../api/student'

interface Question {
  text: string
  credit: number
  min_words: number
  rubric: string[]
}

interface GradeReportProps {
  grades: GradeResult[]
  totalScore: number
  maxScore: number
  isFinal: boolean
  questions: Question[]
}

function getOverallTier(score: number, maxScore: number): 'excellent' | 'good' | 'fair' | 'poor' {
  const pct = maxScore > 0 ? score / maxScore : 0
  if (pct >= 0.85) return 'excellent'
  if (pct >= 0.65) return 'good'
  if (pct >= 0.40) return 'fair'
  return 'poor'
}

const tierStyles = {
  excellent: {
    ring: 'ring-emerald-400/60',
    fill: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    bar: 'bg-gradient-to-r from-emerald-400 to-emerald-500',
    label: 'Excellent',
    labelClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-300/60 dark:text-emerald-400',
  },
  good: {
    ring: 'ring-blue-400/60',
    fill: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    bar: 'bg-gradient-to-r from-blue-400 to-blue-500',
    label: 'Good',
    labelClass: 'bg-blue-500/15 text-blue-700 border-blue-300/60 dark:text-blue-400',
  },
  fair: {
    ring: 'ring-amber-400/60',
    fill: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    bar: 'bg-gradient-to-r from-amber-400 to-amber-500',
    label: 'Needs Work',
    labelClass: 'bg-amber-500/15 text-amber-700 border-amber-300/60 dark:text-amber-400',
  },
  poor: {
    ring: 'ring-red-400/60',
    fill: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    bar: 'bg-gradient-to-r from-red-400 to-red-500',
    label: 'Below Standard',
    labelClass: 'bg-red-500/15 text-red-700 border-red-300/60 dark:text-red-400',
  },
}

export function GradeReport({ grades, totalScore, maxScore, isFinal, questions }: GradeReportProps) {
  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0
  const tier = getOverallTier(totalScore, maxScore)
  const styles = tierStyles[tier]

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Header card — overall score */}
      <Card className={cn('overflow-hidden border-0 shadow-md ring-2', styles.ring, styles.bg)}>
        <CardHeader className="pb-4 pt-6">
          <div className="flex items-start justify-between gap-4">
            {/* Title + badge */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isFinal ? (
                  <Trophy className="size-5 text-primary" />
                ) : (
                  <Eye className="size-5 text-muted-foreground" />
                )}
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Grade Report
                </h2>
              </div>
              <Badge
                variant="outline"
                className={cn('text-xs font-semibold border rounded-full px-2.5 py-0.5', styles.labelClass)}
              >
                {isFinal ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="size-3" />
                    Final Grade
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Eye className="size-3" />
                    Preview
                  </span>
                )}
              </Badge>
            </div>

            {/* Performance label */}
            <Badge
              variant="outline"
              className={cn('text-xs font-semibold border rounded-full px-3 py-1', styles.labelClass)}
            >
              {styles.label}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="pb-6">
          {/* Score display */}
          <div className="flex items-end gap-3 mb-4">
            <span className={cn('text-6xl font-black tabular-nums leading-none', styles.fill)}>
              {totalScore}
            </span>
            <div className="pb-1 space-y-0.5">
              <span className="text-2xl font-bold text-muted-foreground">/ {maxScore}</span>
              <p className="text-xs text-muted-foreground font-medium">marks</p>
            </div>
            <div className="ml-auto pb-1 text-right">
              <p className={cn('text-3xl font-black tabular-nums', styles.fill)}>{pct}%</p>
              <p className="text-xs text-muted-foreground font-medium">percentage</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-3 w-full bg-background/80 rounded-full overflow-hidden shadow-inner">
            <div
              className={cn('h-full rounded-full transition-all duration-700 ease-out', styles.bar)}
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Per-question score pills */}
          {grades.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {grades.map((g) => (
                <div
                  key={g.question_index}
                  className="flex items-center gap-1.5 bg-background/70 rounded-full px-3 py-1 text-xs font-medium border"
                >
                  <span className="text-muted-foreground">Q{g.question_index + 1}</span>
                  <span className="font-bold text-foreground">{g.score}/{g.max_score}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status note */}
      {isFinal ? (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
          <CheckCircle className="size-4 text-primary flex-shrink-0" />
          <p className="text-foreground/80">
            <span className="font-semibold text-foreground">Exam submitted.</span>{' '}
            This is your final result. Your answers have been recorded.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-muted/60 border border-border/60 text-sm">
          <Sparkles className="size-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            <span className="font-semibold text-foreground">This is a preview.</span>{' '}
            You can refine your answers and try again, or submit for final grading when you're ready.
          </p>
        </div>
      )}

      {/* Per-question breakdown */}
      {grades.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Question Breakdown
          </h3>
          <div className="space-y-3">
            {grades.map((grade) => {
              const question = questions[grade.question_index]
              return (
                <QuestionGrade
                  key={grade.question_index}
                  questionIndex={grade.question_index}
                  questionText={question?.text ?? ''}
                  score={grade.score}
                  maxScore={grade.max_score}
                  explanation={grade.explanation}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
