import { CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WordCountProps {
  current: number
  minimum: number
}

export function WordCount({ current, minimum }: WordCountProps) {
  const isMet = current >= minimum

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-sm font-medium transition-colors',
        isMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
      )}
    >
      {isMet ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : (
        <AlertCircle className="size-4 shrink-0" />
      )}
      <span>
        {current} / {minimum} words
      </span>
      {!isMet && (
        <span className="text-muted-foreground font-normal">
          &mdash; minimum {minimum} words required
        </span>
      )}
    </div>
  )
}
