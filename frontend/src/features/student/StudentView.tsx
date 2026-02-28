import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, RefreshCw, Sparkles, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ExamSheet } from './components/ExamSheet'
import { GradeReport } from './components/GradeReport'
import { fetchActiveExam, previewGrading, submitExam } from './api/student'
import type { ExamResponse, GradingResponse } from './api/student'

// Utility: count words in a string
export function getWordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).filter(Boolean).length
}

// Utility: check all answers meet their minimum word counts
export function isAllAnswersValid(
  answers: string[],
  questions: ExamResponse['questions']
): boolean {
  return questions.every((q, i) => getWordCount(answers[i] ?? '') >= q.min_words)
}

export function StudentView() {
  const [exam, setExam] = useState<ExamResponse | null>(null)
  const [answers, setAnswers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Grading flow state
  const [gradingResponse, setGradingResponse] = useState<GradingResponse | null>(null)
  const [isGrading, setIsGrading] = useState(false)
  const [gradingAction, setGradingAction] = useState<'try' | 'submit' | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [gradingError, setGradingError] = useState<string | null>(null)

  const loadExam = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchActiveExam()
      setExam(data)
      setAnswers(data.questions.map(() => ''))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadExam()
  }, [loadExam])

  const handleAnswerChange = useCallback((index: number, value: string) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [])

  const handleTry = useCallback(async () => {
    if (!exam) return
    setIsGrading(true)
    setGradingAction('try')
    setGradingError(null)
    try {
      const answerInputs = answers.map((answer, i) => ({
        question_index: i,
        answer,
      }))
      const result = await previewGrading(exam.id, answerInputs)
      setGradingResponse({ ...result, is_final: false })
    } catch (err) {
      setGradingError(err instanceof Error ? err.message : 'Failed to preview grading')
    } finally {
      setIsGrading(false)
      setGradingAction(null)
    }
  }, [exam, answers])

  const handleSubmit = useCallback(async () => {
    if (!exam) return
    const confirmed = window.confirm(
      'Are you sure? This will finalize your exam and you cannot change your answers.'
    )
    if (!confirmed) return

    setIsGrading(true)
    setGradingAction('submit')
    setGradingError(null)
    try {
      const answerInputs = answers.map((answer, i) => ({
        question_index: i,
        answer,
      }))
      const result = await submitExam(exam.id, answerInputs)
      setGradingResponse({ ...result, is_final: true })
      setIsSubmitted(true)
    } catch (err) {
      setGradingError(err instanceof Error ? err.message : 'Failed to submit exam')
    } finally {
      setIsGrading(false)
      setGradingAction(null)
    }
  }, [exam, answers])

  const allValid = exam !== null && isAllAnswersValid(answers, exam.questions)
  const buttonsDisabled = isGrading || isSubmitted || !allValid

  // Loading state
  if (loading) {
    return (
      <div className="w-full container mx-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
        <div className="mb-8 space-y-1">
          <div className="h-8 w-48 bg-muted animate-pulse rounded-md" />
          <div className="h-4 w-72 bg-muted animate-pulse rounded-md" />
        </div>
        <div className="space-y-5">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="overflow-hidden">
              <CardHeader>
                <div className="h-5 w-32 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="h-4 w-full bg-muted animate-pulse rounded" />
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                <div className="h-[150px] bg-muted animate-pulse rounded-md mt-4" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading exam...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="w-full container mx-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="size-5 text-destructive" />
              <CardTitle className="text-destructive">Failed to Load Exam</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={loadExam}
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!exam) return null

  return (
    <div className="w-full container mx-auto p-4 sm:p-6 lg:p-8 max-w-3xl">
      {/* Page header — hidden in print */}
      <div className="mb-8 print:hidden">
        <h1 className="text-3xl font-bold tracking-tight mb-1.5">Student Exam</h1>
        <p className="text-muted-foreground">
          Read each question carefully and provide a thorough answer.
        </p>
      </div>

      {/* Exam content — hidden in print */}
      <div className="print:hidden">
        <ExamSheet
          exam={exam}
          answers={answers}
          onAnswerChange={handleAnswerChange}
          disabled={isSubmitted}
        />
      </div>

      {/* Action bar — hidden in print */}
      <div className={cn(
        'mt-8 flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors print:hidden',
        isSubmitted
          ? 'bg-muted/30 border-muted'
          : 'bg-muted/40'
      )}>
        <p className="text-sm text-muted-foreground">
          {isSubmitted
            ? 'Exam submitted. View your final grade below.'
            : allValid
              ? 'All answers meet the minimum word count. Ready to grade!'
              : 'Complete all answers to minimum word count before grading.'}
        </p>
        {!isSubmitted && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              disabled={buttonsDisabled}
              onClick={handleTry}
              className="gap-1.5 min-w-[90px]"
            >
              {isGrading && gradingAction === 'try' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Grading...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Try
                </>
              )}
            </Button>
            <Button
              variant="default"
              disabled={buttonsDisabled}
              onClick={handleSubmit}
              className="gap-1.5 min-w-[90px]"
            >
              {isGrading && gradingAction === 'submit' ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Grading...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Submit
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Grading loading indicator — hidden in print */}
      {isGrading && (
        <Card className="mt-4 border-primary/20 bg-primary/5 animate-in fade-in duration-300 print:hidden">
          <CardContent className="py-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Loader2 className="size-5 animate-spin text-primary" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-foreground">
                  AI is grading your answers...
                </p>
                <p className="text-xs text-muted-foreground">
                  Evaluating each response against the rubric. This takes a few seconds.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error display — hidden in print */}
      {gradingError && !isGrading && (
        <Card className="mt-4 border-destructive/40 bg-destructive/5 animate-in fade-in duration-300 print:hidden">
          <CardContent className="py-4">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="size-4 flex-shrink-0 mt-0.5 text-destructive" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-destructive">Grading failed</p>
                <p className="text-sm text-muted-foreground">{gradingError}</p>
                {gradingError.toLowerCase().includes('400') && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Hint: The backend may be missing an OpenAI API key (GRADEAI_OPENAI_API_KEY).
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grade report — remains visible for printing */}
      {gradingResponse && !isGrading && (
        <div className="mt-6">
          <GradeReport
            grades={gradingResponse.grades}
            totalScore={gradingResponse.total_score}
            maxScore={gradingResponse.max_score}
            isFinal={gradingResponse.is_final}
            questions={exam.questions}
          />
        </div>
      )}
    </div>
  )
}
