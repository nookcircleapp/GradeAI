import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { fetchExams } from './api/exams'
import { ExamForm } from './components/ExamForm'
import type { ExamFormData } from './schemas/examSchema'

export function AdminView() {
  const [examData, setExamData] = useState<{ id: number; data: ExamFormData } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadExam() {
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
    }

    loadExam()
  }, [])

  return (
    <div className="w-full container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage exams and questions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exam Management</CardTitle>
          <CardDescription>Edit exam questions and rubrics</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-muted-foreground">Loading exam...</p>
          )}
          {error && (
            <p className="text-destructive">{error}</p>
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
