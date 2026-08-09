import { useState } from 'react'
import { ChevronDown, ListChecks, Loader2, Sparkles } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { WordCount } from './WordCount'
import { QuestionTryResult } from './QuestionTryResult'
import { getWordCount } from '../lib/wordCount'
import { answerLength, isGradable } from '../lib/answerLength'
import type { QuestionTryState } from './QuestionTryResult'

interface Question {
  text: string
  credit: number
  min_words: number
  rubric: string[]
}

interface QuestionCardProps {
  questionIndex: number
  question: Question
  answer: string
  onAnswerChange: (value: string) => void
  disabled?: boolean
  /** Omitted (with `tryState`) wherever a card is shown without its own Try. */
  onTry?: () => void
  tryState?: QuestionTryState
}

export function QuestionCard({
  questionIndex,
  question,
  answer,
  onAnswerChange,
  disabled = false,
  onTry,
  tryState,
}: QuestionCardProps) {
  const [rubricOpen, setRubricOpen] = useState(false)
  const wordCount = getWordCount(answer)
  const pending = tryState?.pending ?? false
  const characters = answerLength(answer)
  // Every Try is a real billed call per selected model, so an answer below the
  // grading floor and a request already in flight both take the button out of
  // play. Whitespace does not count — the length is measured after trimming.
  const tryDisabled = disabled || pending || !isGradable(answer)

  return (
    <Card
      className={cn(
        'gap-0 py-0 transition-shadow duration-200',
        !disabled && 'hover:shadow-md'
      )}
    >
      <CardHeader className="gap-0 px-5 pb-0 pt-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-blue-900 text-sm font-bold text-white">
            {questionIndex + 1}
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Question {questionIndex + 1}
            </CardTitle>
            <p className="mt-1.5 text-[15px] font-medium leading-relaxed text-foreground">
              {question.text}
            </p>
          </div>
          <Badge variant="info" className="shrink-0">
            {question.credit} {question.credit === 1 ? 'mark' : 'marks'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 pb-5 pt-4">
        {/* Answer textarea */}
        <div className="space-y-2.5">
          <Textarea
            value={answer}
            onChange={(e) => onAnswerChange(e.target.value)}
            disabled={disabled}
            placeholder="Type your answer here..."
            className={cn(
              'min-h-[150px] resize-y text-sm leading-relaxed transition-colors',
              'focus-visible:ring-2 focus-visible:ring-primary/30',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          />
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2.5">
            <div className="min-w-[13rem] flex-1">
              <WordCount
                current={wordCount}
                minimum={question.min_words}
                characters={characters}
              />
            </div>
            {onTry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={tryDisabled}
                onClick={onTry}
                className="gap-1.5"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Grading...
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" />
                    Try this answer
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* This question's own result. Stays put while other questions grade. */}
        {tryState && (
          <QuestionTryResult
            questionIndex={questionIndex}
            credit={question.credit}
            state={tryState}
          />
        )}

        {/* Rubric hints (collapsible) */}
        {question.rubric && question.rubric.length > 0 && (
          <div className="overflow-hidden rounded-lg border bg-muted/70">
            <button
              type="button"
              onClick={() => setRubricOpen(!rubricOpen)}
              aria-expanded={rubricOpen}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
            >
              <ListChecks className="size-3.5 shrink-0" />
              <span className="flex-1">Marking criteria</span>
              <ChevronDown
                className={cn(
                  'size-3.5 shrink-0 transition-transform duration-200',
                  rubricOpen && 'rotate-180'
                )}
              />
            </button>
            {rubricOpen && (
              <ul className="space-y-1 border-t border-border/70 px-4 pb-3 pt-2.5">
                {question.rubric.map((point, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-[7px] size-1.5 shrink-0 rounded-full bg-blue-500"
                    />
                    <span className="text-[13.5px] leading-relaxed text-secondary-foreground">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
