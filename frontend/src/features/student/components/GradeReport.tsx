import { CheckCheck, CheckCircle, Download, Eye, Split, Sparkles, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ComparisonPanel } from './ComparisonPanel'
import { ModelScoreboard } from './ModelScoreboard'
import { QuestionComparison } from './QuestionComparison'
import { SingleModelReport } from './SingleModelReport'
import { buildQuestionComparisons, isOk, orderResults, summariseAgreement } from '../lib/comparison'
import type { GradingResponse } from '../api/student'

interface Question {
  text: string
  credit: number
  min_words: number
  rubric: string[]
}

interface GradeReportProps {
  response: GradingResponse
  questions: Question[]
  examTitle?: string
}

export function GradeReport({ response, questions, examTitle }: GradeReportProps) {
  const { max_score: maxScore, is_final: isFinal, submission_id: submissionId, comparison } = response
  const results = orderResults(response.results)
  const okResults = results.filter(isOk)
  const singleModel = results.length === 1

  const comparisons = buildQuestionComparisons(
    results,
    questions.map((q) => q.credit)
  )
  const agreement = summariseAgreement(comparisons)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
      {/* Print-only masthead — the on-screen page header is hidden when printing. */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold">GradeAI — {examTitle ?? 'Grade report'}</h1>
        <p className="text-xs text-muted-foreground">
          {isFinal ? 'Final grade' : 'Preview'}
          {submissionId !== null ? ` · Submission #${submissionId}` : ''}
          {results.length > 1 ? ` · ${results.length} models compared` : ''}
        </p>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {isFinal ? (
              <Trophy className="size-5 text-primary" />
            ) : (
              <Eye className="size-5 text-muted-foreground" />
            )}
            <h2 className="text-2xl font-bold tracking-tight">
              {singleModel ? 'Grade Report' : 'Model Comparison'}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {isFinal ? <CheckCircle className="size-3" /> : <Eye className="size-3" />}
              {isFinal ? 'Final grade' : 'Preview'}
            </Badge>
            {submissionId !== null && (
              <span className="text-xs tabular-nums text-muted-foreground">
                Submission #{submissionId}
              </span>
            )}
            {!singleModel && (
              <span className="text-xs text-muted-foreground">
                {okResults.length} of {results.length} models returned a grade
              </span>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            window.print()
            toast('Print dialog opened — choose "Save as PDF" in your browser.')
          }}
        >
          <Download className="size-3.5" />
          Download PDF
        </Button>
      </header>

      {singleModel ? (
        <SingleModelReport result={results[0]} maxScore={maxScore} questions={questions} />
      ) : (
        <>
          <ModelScoreboard results={results} maxScore={maxScore} comparison={comparison} />

          {okResults.length === 0 && (
            <Card className="avoid-break border-destructive/50">
              <CardContent className="text-sm">
                <p className="font-semibold text-destructive">No model returned a grade.</p>
                <p className="mt-1 text-muted-foreground">
                  Each model&rsquo;s error is shown above. Adjust the model selection and try again.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Hidden entirely when fewer than two models succeeded. */}
          {comparison && (
            <ComparisonPanel comparison={comparison} results={results} maxScore={maxScore} />
          )}
        </>
      )}

      <StatusNote isFinal={isFinal} />

      {!singleModel && comparisons.length > 0 && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Question by question
            </h3>
            {agreement.comparable > 0 && (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <CheckCheck className="size-3.5" />
                  Agreed on {agreement.agreed} of {agreement.comparable}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold">
                  <Split className="size-3.5" />
                  Differed on {agreement.disagreed}
                </span>
              </p>
            )}
          </div>
          <div className="space-y-3">
            {comparisons.map((data) => (
              <QuestionComparison
                key={data.questionIndex}
                questionText={questions[data.questionIndex]?.text ?? ''}
                results={results}
                data={data}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StatusNote({ isFinal }: { isFinal: boolean }) {
  return isFinal ? (
    <div className={cn('flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm')}>
      <CheckCircle className="size-4 shrink-0 text-primary" />
      <p className="text-foreground/80">
        <span className="font-semibold text-foreground">Exam submitted.</span> This is the final
        result. Your answers have been recorded.
      </p>
    </div>
  ) : (
    <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/60 px-4 py-3 text-sm print:hidden">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <p className="text-muted-foreground">
        <span className="font-semibold text-foreground">This is a preview.</span> You can refine
        your answers and try again, or submit for final grading when you&rsquo;re ready.
      </p>
    </div>
  )
}
