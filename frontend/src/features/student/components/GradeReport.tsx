import { AlertTriangle, CheckCheck, CheckCircle, Download, Eye, Split, Sparkles, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
      <div className="hidden border-b border-slate-200 pb-2 print:block">
        <h1 className="text-xl font-extrabold tracking-tight text-blue-900">
          Blink<span className="text-amber-500">Score</span>
          <span className="font-bold text-slate-800"> — {examTitle ?? 'Grade report'}</span>
        </h1>
        <p className="text-xs text-muted-foreground">
          {isFinal ? 'Final grade' : 'Preview'}
          {submissionId !== null ? ` · Submission #${submissionId}` : ''}
          {results.length > 1 ? ` · ${results.length} models compared` : ''}
        </p>
      </div>

      {/* Report masthead — deliberately the same gradient band as the exam sheet
          above it, so the report reads as the second half of the same document. */}
      <header className="overflow-hidden rounded-xl bg-card shadow print:hidden">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 bg-gradient-to-br from-blue-900 via-blue-700 to-blue-600 p-5">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
              {isFinal ? (
                <Trophy className="size-3.5 shrink-0" />
              ) : (
                <Eye className="size-3.5 shrink-0" />
              )}
              <span>{isFinal ? 'Final grade' : 'Preview'}</span>
            </div>
            <h2 className="text-xl font-bold leading-snug tracking-tight text-white">
              {singleModel ? 'Grade Report' : 'Model Comparison'}
            </h2>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/70">
              {submissionId !== null && (
                <span className="tabular-nums">Submission #{submissionId}</span>
              )}
              {submissionId !== null && !singleModel && (
                <span aria-hidden className="text-white/40">
                  ·
                </span>
              )}
              {!singleModel && (
                <span>
                  {okResults.length} of {results.length} models returned a grade
                </span>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 border-transparent shadow-md"
            onClick={() => {
              window.print()
              toast('Print dialog opened — choose "Save as PDF" in your browser.')
            }}
          >
            <Download className="size-3.5" />
            Download PDF
          </Button>
        </div>
      </header>

      {singleModel ? (
        <SingleModelReport result={results[0]} maxScore={maxScore} questions={questions} />
      ) : (
        <>
          <ModelScoreboard results={results} maxScore={maxScore} comparison={comparison} />

          {okResults.length === 0 && (
            <div className="avoid-break flex items-start gap-3 rounded-xl border border-dashed border-destructive/50 bg-destructive/[0.04] px-5 py-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-bold text-destructive">No model returned a grade.</p>
                <p className="leading-relaxed text-muted-foreground">
                  Each model&rsquo;s error is shown above. Adjust the model selection and try again.
                </p>
              </div>
            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Question by question
            </h3>
            {agreement.comparable > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <AgreementSummaryChip
                  icon={CheckCheck}
                  filled={false}
                  text={`Agreed on ${agreement.agreed} of ${agreement.comparable}`}
                />
                <AgreementSummaryChip
                  icon={Split}
                  filled={agreement.disagreed > 0}
                  text={`Differed on ${agreement.disagreed}`}
                />
              </div>
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

/**
 * Deliberately the same two shapes as the per-question agreement chip: outlined
 * for agreement, filled for divergence. Icon and wording carry it in grayscale.
 */
function AgreementSummaryChip({
  icon: Icon,
  filled,
  text,
}: {
  icon: typeof CheckCheck
  filled: boolean
  text: string
}) {
  return (
    <span
      className={cn(
        'print-exact inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]',
        filled
          ? 'bg-foreground text-background'
          : 'border border-slate-300 bg-card text-muted-foreground'
      )}
    >
      <Icon className="size-3" />
      {text}
    </span>
  )
}

function StatusNote({ isFinal }: { isFinal: boolean }) {
  return isFinal ? (
    <div className="flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-sm">
      <CheckCircle className="size-4 shrink-0 text-blue-700" />
      <p className="text-blue-900/80">
        <span className="font-semibold text-blue-900">Exam submitted.</span> This is the final
        result. Your answers have been recorded.
      </p>
    </div>
  ) : (
    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm print:hidden">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-500" />
      <p className="text-muted-foreground">
        <span className="font-semibold text-slate-800">This is a preview.</span> You can refine your
        answers and try again, or submit for final grading when you&rsquo;re ready.
      </p>
    </div>
  )
}
