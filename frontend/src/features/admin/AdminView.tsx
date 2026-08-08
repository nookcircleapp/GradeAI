import { useState, useEffect, useCallback } from 'react'
import { AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AdminAuthError, fetchAdminExams } from './api/exams'
import { getAdminToken, setAdminToken } from './lib/adminToken'
import { ExamForm } from './components/ExamForm'
import { AdminGate } from './components/AdminGate'
import type { ExamFormData } from './schemas/examSchema'

/**
 * The admin dashboard, gated as a whole.
 *
 * Nothing here loads until the server has accepted the admin password: the only
 * read is `GET /api/exams/admin`, which 401s without a valid token and is the
 * one endpoint that returns reference answers. That is what makes a save safe —
 * the form is always holding the complete exam, so it cannot write back a
 * question whose reference answers it never received.
 */
export function AdminView() {
  const [token, setToken] = useState<string | null>(() => getAdminToken())
  const [examData, setExamData] = useState<{ id: number; data: ExamFormData } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  // Bumped on every successful load so the form remounts against fresh
  // defaults — react-hook-form reads defaultValues once, on mount.
  const [loadCount, setLoadCount] = useState(0)

  /**
   * Check a password by using it, and load the exam with it if it holds. The
   * read doubles as the validation step, so a wrong password is caught at the
   * gate instead of after a form has been filled in.
   */
  const authenticate = useCallback(async (candidate: string) => {
    setIsLoading(true)
    setError(null)
    setUnlockError(null)
    try {
      const exams = await fetchAdminExams(candidate)
      // The server accepted the token, so it is worth keeping for the session.
      setAdminToken(candidate)
      setToken(candidate)
      if (exams.length === 0) {
        setExamData(null)
        setError('No exams found')
        return
      }
      const exam = exams[0]
      setExamData({
        id: exam.id,
        data: {
          title: exam.title,
          questions: exam.questions.map((question) => ({
            text: question.text,
            credit: question.credit,
            min_words: question.min_words,
            rubric: question.rubric,
            // Absent only on an exam written before the field existed.
            reference_answers: question.reference_answers ?? [],
          })),
        },
      })
      setLoadCount((count) => count + 1)
    } catch (err) {
      if (err instanceof AdminAuthError) {
        // The API layer has already dropped the rejected token from storage.
        setToken(null)
        setExamData(null)
        setUnlockError(err.message)
        return
      }
      // Not an authentication problem — stay unlocked and offer a retry.
      setToken(candidate)
      setError(err instanceof Error ? err.message : 'Failed to load exam')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    // A password held from earlier in this tab's session is re-checked on the
    // way in rather than trusted, so a server-side token change locks us out
    // here instead of failing later at the save.
    const stored = getAdminToken()
    if (stored !== null) void authenticate(stored)
  }, [authenticate])

  /** A 401 on a later request means the held token has stopped working. */
  const handleAuthError = useCallback((message: string) => {
    setToken(null)
    setExamData(null)
    setUnlockError(message)
  }, [])

  return (
    <div className="w-full container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1.5">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage exams and questions</p>
      </div>

      {token === null ? (
        <AdminGate errorMessage={unlockError} busy={isLoading} onUnlock={authenticate} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Exam Management</CardTitle>
            <CardDescription>Edit exam questions, rubrics and reference answers</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="size-4 animate-spin" />
                <span>Loading exam...</span>
              </div>
            )}
            {error && !isLoading && (
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
                    <Button
                      variant="outline"
                      onClick={() => void authenticate(token)}
                      className="gap-2"
                    >
                      <RefreshCw className="size-4" />
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}
            {examData && !isLoading && (
              <ExamForm
                key={`${examData.id}-${loadCount}`}
                defaultValues={examData.data}
                examId={examData.id}
                adminToken={token}
                onAuthError={handleAuthError}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
