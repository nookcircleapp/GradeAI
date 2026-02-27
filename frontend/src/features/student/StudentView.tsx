import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExamSheet } from './components/ExamSheet'
import { fetchActiveExam } from './api/student'
import type { ExamResponse } from './api/student'

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

  const allValid = exam !== null && isAllAnswersValid(answers, exam.questions)

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
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1.5">Student Exam</h1>
        <p className="text-muted-foreground">
          Read each question carefully and provide a thorough answer.
        </p>
      </div>

      {/* Exam content */}
      <ExamSheet
        exam={exam}
        answers={answers}
        onAnswerChange={handleAnswerChange}
      />

      {/* Action buttons */}
      <div className="mt-8 flex items-center justify-between gap-4 p-4 bg-muted/40 rounded-xl border">
        <p className="text-sm text-muted-foreground">
          {allValid
            ? 'All answers meet the minimum word count. Ready to submit!'
            : 'Complete all answers to minimum word count before submitting.'}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            disabled={!allValid}
            title="AI grading preview — available in next update"
          >
            Try
          </Button>
          <Button
            variant="default"
            disabled={!allValid}
            title="Submit exam — available in next update"
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  )
}
