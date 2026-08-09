import { useState, useEffect, useCallback, useRef } from 'react'
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
import {
  MIN_ANSWER_CHARS,
  formatQuestionList,
  gradableIndexes,
  isGradable,
  tooShortIndexes,
} from './lib/answerLength'
import { remapResultsToQuestions } from './lib/comparison'
import type { QuestionTryState } from './components/QuestionTryResult'
import type { ExamResponse, GradingResponse, ModelInfo } from './api/student'

/**
 * The app shell: same maximum width and same horizontal padding as AppHeader, so
 * the page content lines up with the wordmark above it. The reading column is
 * narrowed *inside* this, never by shrinking the shell — otherwise the wide
 * comparison report and the narrow exam sheet would sit on different left edges.
 */
const SHELL = 'mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8'

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

  // Per-question Try, keyed by question index and entirely independent of the
  // global run: several questions may be in flight at once and each keeps its
  // own result until that question is tried again.
  const [questionTries, setQuestionTries] = useState<Record<number, QuestionTryState>>({})
  // The disabled button is the visible guard; this is the one that actually
  // holds, because a click can land before React has re-rendered the button.
  const questionsInFlight = useRef<Set<number>>(new Set())

  const loadExam = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchActiveExam()
      setExam(data)
      setAnswers(data.questions.map(() => ''))
      setQuestionTries({})
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
    // A preview only covers what has actually been written: answers below the
    // grading floor are never sent, and the buttons above are already disabled
    // while any started answer is short, so nothing is skipped silently.
    const gradable = gradableIndexes(answers)
    if (gradable.length === 0) return
    setIsGrading(true)
    setGradingAction('try')
    setGradingError(null)
    try {
      const answerInputs = gradable.map((i) => ({
        question_index: i,
        answer: answers[i],
      }))
      const result = await previewGrading(exam.id, answerInputs, selectedModelIds)
      setGradingResponse({
        ...result,
        is_final: false,
        results: remapResultsToQuestions(result.results, gradable),
      })
    } catch (err) {
      setGradingError(err instanceof Error ? err.message : 'Failed to preview grading')
    } finally {
      setIsGrading(false)
      setGradingAction(null)
    }
  }, [exam, answers, selectedModelIds])

  /**
   * Grade one question on its own. The request carries only that answer, so the
   * response's marks are out of that question's credit rather than the paper's.
   */
  const handleQuestionTry = useCallback(
    async (index: number) => {
      if (!exam) return
      if (questionsInFlight.current.has(index)) return
      const answer = answers[index] ?? ''
      // Belt and braces with the disabled button: never spend a call on an
      // answer the backend is going to score zero anyway.
      if (!isGradable(answer)) return

      questionsInFlight.current.add(index)
      setQuestionTries((prev) => ({
        ...prev,
        // The previous result is carried through so the card does not go blank
        // while the new marks are on their way.
        [index]: { pending: true, response: prev[index]?.response ?? null, error: null },
      }))
      try {
        const result = await previewGrading(
          exam.id,
          [{ question_index: index, answer }],
          selectedModelIds
        )
        setQuestionTries((prev) => ({
          ...prev,
          [index]: { pending: false, response: { ...result, is_final: false }, error: null },
        }))
      } catch (err) {
        setQuestionTries((prev) => ({
          ...prev,
          [index]: {
            pending: false,
            response: prev[index]?.response ?? null,
            error: err instanceof Error ? err.message : 'Failed to grade this answer',
          },
        }))
      } finally {
        questionsInFlight.current.delete(index)
      }
    },
    [exam, answers, selectedModelIds]
  )

  // Submitting grades the whole paper, so the final mark is out of the paper's
  // real total — which means every question has to clear the floor first. That
  // is also what keeps a blank answer from ever reaching a model.
  const submitBlocked = answers.length === 0 || answers.some((answer) => !isGradable(answer))

  const handleSubmit = useCallback(() => {
    if (!exam || submitBlocked) return
    setShowSubmitDialog(true)
  }, [exam, submitBlocked])

  const handleConfirmSubmit = useCallback(async () => {
    // Re-checked here as well as on the button: the dialog must not be a way
    // around the minimum.
    if (!exam || submitBlocked) return
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
  }, [exam, answers, selectedModelIds, submitBlocked])

  const buttonsDisabled = isGrading || isSubmitted
  const modelCount = selectedModelIds.length
  const gradableQuestions = gradableIndexes(answers)
  const shortQuestions = tooShortIndexes(answers)
  const unansweredQuestions = answers
    .map((_, index) => index)
    .filter((index) => !isGradable(answers[index]))

  // Loading state
  if (loading) {
    return (
      <div className={cn(SHELL, 'max-w-3xl')}>
        <div className="mb-6 h-[104px] animate-pulse rounded-xl bg-muted" />
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
      <div className={cn(SHELL, 'max-w-3xl')}>
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
    <div className={cn(SHELL, 'print:max-w-none print:p-0')}>
      {/* The reading column. AppHeader already names this view ("Student Exam"),
          so there is no in-page <h1> repeating it — the exam's own title is the
          first heading on the page. */}
      <div className="mx-auto max-w-3xl">
        {/* Model selection — above the exam, because it governs every Try button
            on the page, not just the action bar at the bottom. Choosing graders
            is the first decision, so it reads first. */}
        {!isSubmitted && (
          <div className="mb-6 print:hidden">
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

        {/* Exam content — hidden in print */}
        <div className="print:hidden">
          <ExamSheet
            exam={exam}
            answers={answers}
            onAnswerChange={handleAnswerChange}
            disabled={isSubmitted}
            onQuestionTry={isSubmitted ? undefined : handleQuestionTry}
            tryStates={questionTries}
          />
        </div>

        {/* Action bar — hidden in print */}
        <div className={cn(
          'mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 shadow-sm transition-colors print:hidden',
          isSubmitted ? 'border-muted bg-muted/30' : 'bg-muted/70'
        )}>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-secondary-foreground">
              {isSubmitted
                ? 'Exam submitted. View your final grade below.'
                : modelCount > 1
                  ? `Try grading at any time — ${modelCount} models will grade side by side.`
                  : 'Try grading at any time, or submit when ready.'}
            </p>
            {/* Nothing is skipped quietly: whatever Try will and will not grade
                is named here, and Submit says exactly what it is waiting for. */}
            {!isSubmitted && (
              <p className="text-xs text-muted-foreground">
                {gradableQuestions.length === 0
                  ? `Write at least ${MIN_ANSWER_CHARS} characters in an answer before grading.`
                  : shortQuestions.length > 0
                    ? `Try grades ${gradableQuestions.length} of ${answers.length} answers — ${formatQuestionList(
                        shortQuestions
                      )} ${shortQuestions.length === 1 ? 'is' : 'are'} under ${MIN_ANSWER_CHARS} characters and will be left out.`
                    : `Try grades ${gradableQuestions.length} of ${answers.length} answers.`}
                {unansweredQuestions.length > 0 &&
                  ` Submitting grades the whole paper, so ${formatQuestionList(
                    unansweredQuestions
                  )} ${unansweredQuestions.length === 1 ? 'needs' : 'need'} at least ${MIN_ANSWER_CHARS} characters first.`}
              </p>
            )}
          </div>
          {!isSubmitted && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                disabled={buttonsDisabled || gradableQuestions.length === 0}
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
                disabled={buttonsDisabled || submitBlocked}
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
          <Card className="mt-4 border-blue-200 bg-blue-50 animate-in fade-in duration-300 print:hidden">
            <CardContent className="py-5">
              <div className="flex items-center gap-3">
                <Loader2 className="size-5 animate-spin text-blue-700" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-blue-900">
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
                      Hint: the server may be missing an API key for one of the selected models.
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
              All {answers.length} answers will be graded and your exam finalized. You cannot change
              your answers after submission.
              {modelCount > 1 && ` All ${modelCount} selected models will grade your answers.`}
            </DialogDescription>
          </DialogHeader>
          {submitBlocked && (
            <p className="text-sm text-destructive">
              {formatQuestionList(unansweredQuestions)}{' '}
              {unansweredQuestions.length === 1 ? 'needs' : 'need'} at least {MIN_ANSWER_CHARS}{' '}
              characters before the exam can be submitted.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSubmit} disabled={submitBlocked}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
