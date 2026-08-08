import { useState, useEffect, useCallback } from 'react'
import { Loader2, AlertCircle, RefreshCw, Sparkles, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ExamSheet } from './components/ExamSheet'
import { GradeReport } from './components/GradeReport'
import { ModelPicker } from './components/ModelPicker'
import { fetchActiveExam, fetchModels, previewGrading, submitExam } from './api/student'
import { defaultSelection } from './lib/modelSelection'
import type { ExamResponse, GradingResponse, ModelInfo } from './api/student'

export function StudentView() {
  const [exam, setExam] = useState<ExamResponse | null>(null)
  const [answers, setAnswers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Model selection state
  const [models, setModels] = useState<ModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([])

  // Grading flow state
  const [gradingResponse, setGradingResponse] = useState<GradingResponse | null>(null)
  const [isGrading, setIsGrading] = useState(false)
  const [gradingAction, setGradingAction] = useState<'try' | 'submit' | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [gradingError, setGradingError] = useState<string | null>(null)
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)

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

  // The registry is loaded independently of the exam: if it fails the exam is
  // still gradable, the backend just falls back to its default model.
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    setModelsError(null)
    try {
      const data = await fetchModels()
      setModels(data)
      setSelectedModelIds(defaultSelection(data))
    } catch (err) {
      setModels([])
      setSelectedModelIds([])
      setModelsError(err instanceof Error ? err.message : 'Failed to load the model registry.')
    } finally {
      setModelsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadExam()
    loadModels()
  }, [loadExam, loadModels])

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
      const result = await previewGrading(exam.id, answerInputs, selectedModelIds)
      setGradingResponse({ ...result, is_final: false })
    } catch (err) {
      setGradingError(err instanceof Error ? err.message : 'Failed to preview grading')
    } finally {
      setIsGrading(false)
      setGradingAction(null)
    }
  }, [exam, answers, selectedModelIds])

  const handleSubmit = useCallback(() => {
    if (!exam) return
    setShowSubmitDialog(true)
  }, [exam])

  const handleConfirmSubmit = useCallback(async () => {
    if (!exam) return
    setShowSubmitDialog(false)
    setIsGrading(true)
    setGradingAction('submit')
    setGradingError(null)
    try {
      const answerInputs = answers.map((answer, i) => ({
        question_index: i,
        answer,
      }))
      const result = await submitExam(exam.id, answerInputs, selectedModelIds)
      setGradingResponse({ ...result, is_final: true })
      setIsSubmitted(true)
    } catch (err) {
      setGradingError(err instanceof Error ? err.message : 'Failed to submit exam')
    } finally {
      setIsGrading(false)
      setGradingAction(null)
    }
  }, [exam, answers, selectedModelIds])

  const buttonsDisabled = isGrading || isSubmitted
  const modelCount = selectedModelIds.length

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

  const wideReport = (gradingResponse?.results.length ?? 0) > 1

  return (
    <div className="w-full container mx-auto p-4 sm:p-6 lg:p-8 max-w-6xl print:max-w-none print:p-0">
      <div className="mx-auto max-w-3xl">
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

        {/* Model selection — sits directly above the grading controls it affects */}
        {!isSubmitted && (
          <div className="mt-8 print:hidden">
            <ModelPicker
              models={models}
              selectedIds={selectedModelIds}
              onChange={setSelectedModelIds}
              loading={modelsLoading}
              error={modelsError}
              disabled={isGrading}
            />
          </div>
        )}

        {/* Action bar — hidden in print */}
        <div className={cn(
          'mt-4 flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border transition-colors print:hidden',
          isSubmitted
            ? 'bg-muted/30 border-muted'
            : 'bg-muted/40'
        )}>
          <p className="text-sm text-muted-foreground">
            {isSubmitted
              ? 'Exam submitted. View your final grade below.'
              : modelCount > 1
                ? `Try grading at any time — ${modelCount} models will grade side by side.`
                : 'Try grading at any time, or submit when ready.'}
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
                <Loader2 className="size-5 animate-spin text-primary" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">
                    {modelCount > 1
                      ? `${modelCount} models are grading your answers...`
                      : 'AI is grading your answers...'}
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
                  {gradingError.toLowerCase().includes('api key') && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Hint: The backend may be missing a provider API key (GRADEAI_OPENAI_API_KEY /
                      GRADEAI_GROQ_API_KEY).
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Grade report — remains visible for printing */}
      {gradingResponse && !isGrading && (
        <div
          className={cn(
            'mt-6 mx-auto print:mt-0 print:max-w-none',
            wideReport ? 'max-w-6xl' : 'max-w-3xl'
          )}
        >
          <GradeReport
            response={gradingResponse}
            questions={exam.questions}
            examTitle={exam.title}
          />
        </div>
      )}

      {/* Submit confirmation dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit exam?</DialogTitle>
            <DialogDescription>
              This will finalize your exam. You cannot change your answers after submission.
              {modelCount > 1 && ` All ${modelCount} selected models will grade your answers.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
