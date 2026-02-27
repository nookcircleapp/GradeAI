import { BookOpen, Award } from 'lucide-react'
import type { ExamResponse } from '../api/student'
import { QuestionCard } from './QuestionCard'

interface ExamSheetProps {
  exam: ExamResponse
  answers: string[]
  onAnswerChange: (index: number, value: string) => void
  disabled?: boolean
}

export function ExamSheet({ exam, answers, onAnswerChange, disabled = false }: ExamSheetProps) {
  const totalMarks = exam.questions.reduce((sum, q) => sum + q.credit, 0)

  return (
    <div className="space-y-6">
      {/* Exam header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <BookOpen className="size-4 shrink-0" />
            <span>Exam</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {exam.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            Answer all {exam.questions.length} questions below. Your progress is saved automatically.
          </p>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 bg-muted/60 rounded-lg px-4 py-2.5 text-sm font-semibold">
          <Award className="size-4 text-primary" />
          <span className="text-foreground">
            Total: <span className="text-primary">{totalMarks}</span> marks
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
          />
        ))}
      </div>
    </div>
  )
}
