import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, XCircle, MessageSquare } from 'lucide-react'

interface QuestionGradeProps {
  questionIndex: number
  questionText: string
  score: number
  maxScore: number
  explanation: string
}

function getScoreTier(score: number, maxScore: number): 'high' | 'mid' | 'low' {
  const pct = maxScore > 0 ? score / maxScore : 0
  if (pct >= 0.7) return 'high'
  if (pct >= 0.4) return 'mid'
  return 'low'
}

// Light-only: the `dark:` variants these entries used to carry were inert (see
// globals.css — there is no `.dark` palette) and have been dropped.
const tierConfig = {
  high: {
    badge: 'border-emerald-300/60 bg-emerald-500/15 text-emerald-700',
    bar: 'bg-emerald-500',
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    border: 'border-l-emerald-400',
  },
  mid: {
    badge: 'border-amber-300/60 bg-amber-500/15 text-amber-700',
    bar: 'bg-amber-500',
    icon: AlertTriangle,
    iconClass: 'text-amber-500',
    border: 'border-l-amber-400',
  },
  low: {
    badge: 'border-red-300/60 bg-red-500/15 text-red-700',
    bar: 'bg-red-500',
    icon: XCircle,
    iconClass: 'text-red-500',
    border: 'border-l-red-400',
  },
}

export function QuestionGrade({
  questionIndex,
  questionText,
  score,
  maxScore,
  explanation,
}: QuestionGradeProps) {
  const tier = getScoreTier(score, maxScore)
  const config = tierConfig[tier]
  const Icon = config.icon
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0

  return (
    <Card
      className={cn(
        'overflow-hidden border-l-4 transition-shadow duration-200 hover:shadow-md gap-0',
        config.border
      )}
    >
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-3">
          {/* Question label + icon */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-muted text-muted-foreground text-xs font-bold">
              {questionIndex + 1}
            </span>
            <span className="text-sm font-semibold text-foreground">
              Question {questionIndex + 1}
            </span>
            <Icon className={cn('size-4 flex-shrink-0', config.iconClass)} />
          </div>

          {/* Score badge */}
          <Badge
            variant="outline"
            className={cn(
              'flex-shrink-0 text-sm font-bold px-3 py-1 rounded-full border',
              config.badge
            )}
          >
            {score} / {maxScore}
          </Badge>
        </div>

        {/* Mini score bar */}
        <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', config.bar)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{pct}% of available marks</p>
      </CardHeader>

      <CardContent className="pt-0 pb-5 space-y-4">
        {/* Question text (reference) */}
        <div className="text-sm text-muted-foreground leading-relaxed italic border-l-2 border-muted pl-3">
          {questionText}
        </div>

        {/* AI explanation */}
        <div className="flex gap-2.5">
          <MessageSquare className="size-4 flex-shrink-0 mt-0.5 text-muted-foreground/70" />
          <p className="text-sm leading-relaxed text-foreground/80">{explanation}</p>
        </div>
      </CardContent>
    </Card>
  )
}
