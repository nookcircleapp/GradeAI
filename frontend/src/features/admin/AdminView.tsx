import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fetchExams } from './api/exams'
import { ExamForm } from './components/ExamForm'
import type { ExamFormData } from './schemas/examSchema'

export function AdminView() {
  const [examData, setExamData] = useState<{ id: number; data: ExamFormData } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadExam = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const exams = await fetchExams()
      if (exams.length > 0) {
        const exam = exams[0]
        setExamData({
          id: exam.id,
          data: {
            title: exam.title,
            questions: exam.questions,
          },
        })
      } else {
        setError('No exams found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exam')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadExam()
  }, [loadExam])

  return (
    <div className="w-full container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1.5">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage exams and questions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exam Management</CardTitle>
          <CardDescription>Edit exam questions and rubrics</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="size-4 animate-spin" />
              <span>Loading exam...</span>
            </div>
          )}
          {error && (
            <div className="py-4">
              <Card className="border-destructive/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="size-5 text-destructive" />
                    <CardTitle className="text-destructive">Failed to Load Exam</CardTitle>
                  </div>
                  <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" onClick={loadExam} className="gap-2">
                    <RefreshCw className="size-4" />
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
          {examData && (
            <ExamForm
              defaultValues={examData.data}
              examId={examData.id}
              onSaved={() => {
                // Optionally reload exam after save
                console.log('Exam saved successfully')
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
