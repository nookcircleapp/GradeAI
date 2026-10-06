import { cn } from '@/lib/utils'
import { MIN_ANSWER_CHARS } from '../lib/answerLength'

interface WordCountProps {
  current: number
  minimum: number
  /** Trimmed character count — the hard gate, unlike the advisory word target. */
  characters: number
}

/**
 * Two readings of the same answer, kept deliberately apart.
 *
 * The amber bar tracks the question's suggested word count: it is advice, it
 * fills to 100% and stops, and nothing anywhere refuses to grade because of it.
 * The line underneath is the actual gate — {@link MIN_ANSWER_CHARS} characters —
 * and is the only one of the two that ever turns emphatic. Giving the suggestion
 * the bar and the gate the sentence keeps a half-full bar from reading as a
 * blocked form, which is exactly what merging them into one meter would do.
 */
export function WordCount({ current, minimum, characters }: WordCountProps) {
  // Only an answer that has been started but left short is "unmet". An untouched
  // box is simply untouched, and must not read as though the form is failing.
  const unmet = characters > 0 && characters < MIN_ANSWER_CHARS
  const pct = minimum > 0 ? Math.min(Math.round((current / minimum) * 100), 100) : 0

  return (
    <div className="space-y-1.5">
      {minimum > 0 ? (
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap text-[11.5px] text-muted-foreground">
            {current} word{current === 1 ? '' : 's'}
          </span>
          <div
            className="h-1.5 min-w-[2.5rem] flex-1 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${current} of ${minimum} suggested words`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-[11.5px] font-semibold tabular-nums text-amber-600">
            suggested: {minimum}+
          </span>
        </div>
      ) : (
        <p className="text-[11.5px] text-muted-foreground">
          {current} word{current === 1 ? '' : 's'}
        </p>
      )}

      <p
        className={cn(
          'text-[11.5px] leading-snug text-muted-foreground',
          unmet && 'font-semibold text-foreground'
        )}
      >
        {unmet
          ? `${characters} of ${MIN_ANSWER_CHARS} characters needed to grade`
          : `${MIN_ANSWER_CHARS} characters minimum`}
      </p>
    </div>
  )
}
