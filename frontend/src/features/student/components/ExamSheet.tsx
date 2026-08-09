import { Award, BookOpen } from 'lucide-react'
import type { ExamResponse } from '../api/student'
import { QuestionCard } from './QuestionCard'
import { isGradable } from '../lib/answerLength'
import type { QuestionTryState } from './QuestionTryResult'

interface ExamSheetProps {
  exam: ExamResponse
  answers: string[]
  onAnswerChange: (index: number, value: string) => void
  disabled?: boolean
  /** Per-question Try, keyed by question index. Omit to hide the per-question control. */
  onQuestionTry?: (index: number) => void
  tryStates?: Record<number, QuestionTryState>
}

export function ExamSheet({
  exam,
  answers,
  onAnswerChange,
  disabled = false,
  onQuestionTry,
  tryStates,
}: ExamSheetProps) {
  const totalMarks = exam.questions.reduce((sum, q) => sum + q.credit, 0)
  const totalCount = exam.questions.length
  // "Answered" means the same thing here as it does everywhere else in the view:
  // long enough to actually be graded. A three-character answer filling the bar
  // would promise progress the Submit button then refuses to honour.
  const answeredCount = exam.questions.filter((_, i) => isGradable(answers[i] ?? '')).length
  const progress = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Exam header */}
      <div className="overflow-hidden rounded-xl bg-card shadow">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 bg-gradient-to-br from-blue-900 via-blue-700 to-blue-600 p-5">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
              <BookOpen className="size-3.5 shrink-0" />
              <span>Exam</span>
            </div>
            <h2 className="text-lg font-bold leading-snug text-white">{exam.title}</h2>
            <p className="text-sm text-white/70">
              Answer all {totalCount} questions below. Your progress is saved automatically.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-amber-500 px-4 py-1.5 text-sm font-bold text-white shadow-md">
            <Award className="size-4" />
            Total: {totalMarks} {totalMarks === 1 ? 'mark' : 'marks'}
          </span>
        </div>

        <div className="flex items-center gap-3 px-5 py-4">
          <span className="whitespace-nowrap text-sm text-muted-foreground">Progress</span>
          <div
            className="h-1.5 min-w-[3rem] flex-1 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${answeredCount} of ${totalCount} questions answered`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-blue-700">
            {answeredCount} / {totalCount} answered
          </span>
        </div>
      </div>

      {/* Question cards */}
      <div className="space-y-5">
        {exam.questions.map((question, index) => (
          <QuestionCard
            key={index}
            questionIndex={index}
            question={question}
            answer={answers[index] ?? ''}
            onAnswerChange={(value) => onAnswerChange(index, value)}
            disabled={disabled}
            onTry={onQuestionTry ? () => onQuestionTry(index) : undefined}
            tryState={tryStates?.[index]}
          />
        ))}
      </div>
    </div>
  )
}
