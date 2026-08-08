import { cn } from '@/lib/utils'
import { MIN_ANSWER_CHARS } from '../lib/answerLength'

interface WordCountProps {
  current: number
  minimum: number
  /** Trimmed character count — the hard gate, unlike the advisory word target. */
  characters: number
}

export function WordCount({ current, minimum, characters }: WordCountProps) {
  // Only an answer that has been started but left short is "unmet". An untouched
  // box is simply untouched, and must not read as though the form is failing.
  const unmet = characters > 0 && characters < MIN_ANSWER_CHARS

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
      <span>
        {current} word{current === 1 ? '' : 's'}
        {minimum > 0 && (
          <span className="ml-1 opacity-70">(suggested: {minimum}+)</span>
        )}
      </span>
      <span aria-hidden className="opacity-40">
        ·
      </span>
      <span className={cn(unmet && 'font-medium text-foreground')}>
        {unmet
          ? `${characters} of ${MIN_ANSWER_CHARS} characters needed to grade`
          : `${MIN_ANSWER_CHARS} characters minimum`}
      </span>
    </div>
  )
}
