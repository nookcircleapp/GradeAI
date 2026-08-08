import { useState } from 'react'
import { ChevronDown, ChevronUp, ListChecks, Loader2, Sparkles } from 'lucide-react'
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
    <Card className={cn(
      'transition-shadow duration-200',
      !disabled && 'hover:shadow-md'
    )}>
      <CardHeader className="pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
              {questionIndex + 1}
            </span>
            <CardTitle className="text-base font-semibold text-foreground/90">
              Question {questionIndex + 1}
            </CardTitle>
          </div>
          <Badge variant="secondary" className="flex-shrink-0 text-xs px-2.5 py-1 font-semibold">
            {question.credit} {question.credit === 1 ? 'mark' : 'marks'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Question text */}
        <p className="text-base leading-relaxed text-foreground font-medium">
          {question.text}
        </p>

        {/* Answer textarea */}
        <div className="space-y-2">
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <WordCount
              current={wordCount}
              minimum={question.min_words}
              characters={characters}
            />
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
          <div className="border-t pt-3">
            <button
              type="button"
              onClick={() => setRubricOpen(!rubricOpen)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
            >
              <ListChecks className="size-3.5" />
              <span>Marking criteria</span>
              {rubricOpen ? (
                <ChevronUp className="size-3 ml-0.5" />
              ) : (
                <ChevronDown className="size-3 ml-0.5" />
              )}
            </button>
            {rubricOpen && (
              <ul className="mt-2 space-y-1.5 pl-5">
                {question.rubric.map((point, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted-foreground list-disc leading-relaxed"
                  >
                    {point}
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
