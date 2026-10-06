import type { ModelResult, ModelTier } from '../api/student'

/** Shown wherever a provider did not report a number. Never print a fabricated value. */
export const NOT_REPORTED = 'not reported'

/** Extrapolation factor used by the cost panel. Always labelled on screen. */
export const GRADINGS_PER_BATCH = 1000

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

export function formatDuration(ms: number | null | undefined): string {
  if (!isNum(ms)) return NOT_REPORTED
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)} s`
}

export function formatCount(value: number | null | undefined): string {
  if (!isNum(value)) return NOT_REPORTED
  return value.toLocaleString('en-US')
}

/**
 * Money at grading scale spans several orders of magnitude ($0.000052 … $6.50),
 * so pick enough decimals to keep two significant digits rather than rounding
 * a real cost down to "$0.00".
 */
export function formatUsd(value: number | null | undefined): string {
  if (!isNum(value)) return NOT_REPORTED
  if (value === 0) return '$0.00'
  const abs = Math.abs(value)
  const decimals = abs >= 1 ? 2 : Math.min(8, Math.max(2, Math.ceil(-Math.log10(abs)) + 2))
  const trimmed = value.toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '')
  const [whole, fraction = ''] = trimmed.split('.')
  return `$${whole}.${fraction.padEnd(2, '0')}`
}

export function formatRatio(value: number | null | undefined): string | null {
  if (!isNum(value)) return null
  return value >= 100 ? `${Math.round(value)}` : value.toFixed(1)
}

export function formatPercent(score: number, maxScore: number): number {
  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
}

/* -------------------------------------------------------------------------- */
/* Result shaping                                                             */
/* -------------------------------------------------------------------------- */

const TIER_RANK: Record<ModelTier, number> = { large: 0, small: 1, local: 2 }

/**
 * Large models first, then small, then the local scorer, so every column, bar
 * and row reads "frontier → compact → no LLM" in the same left-to-right order
 * regardless of the order the backend happened to return. That order is the
 * argument the report is making.
 */
export function orderResults(results: ModelResult[]): ModelResult[] {
  return [...results].sort(
    (a, b) => (TIER_RANK[a.tier] ?? 99) - (TIER_RANK[b.tier] ?? 99)
  )
}

export const isOk = (result: ModelResult): boolean => result.status === 'ok'

/* -------------------------------------------------------------------------- */
/* Agreement analysis                                                         */
/* -------------------------------------------------------------------------- */

export interface QuestionComparison {
  questionIndex: number
  maxScore: number
  /** model_id → score, only for models that actually graded this question. */
  scores: Record<string, number>
  lowest: number | null
  highest: number | null
  /** highest − lowest. 0 when every model landed on the same mark. */
  delta: number
  /** True only when at least two models graded it AND they differ. */
  disagree: boolean
  /** True when at least two models graded this question. */
  comparable: boolean
}

/**
 * Compare every model's mark for one question. `credit` is the exam's own mark
 * allocation and is only used when no model reported a `max_score` — a model
 * that errored contributes nothing rather than dragging the row to zero.
 */
export function buildQuestionComparison(
  results: ModelResult[],
  questionIndex: number,
  credit: number
): QuestionComparison {
  const scores: Record<string, number> = {}
  let maxScore = credit
  for (const result of results) {
    const grade = result.grades.find((g) => g.question_index === questionIndex)
    if (!grade) continue
    scores[result.model_id] = grade.score
    if (isNum(grade.max_score)) maxScore = grade.max_score
  }
  const values = Object.values(scores)
  const comparable = values.length >= 2
  const lowest = values.length > 0 ? Math.min(...values) : null
  const highest = values.length > 0 ? Math.max(...values) : null
  const delta = comparable && lowest !== null && highest !== null ? highest - lowest : 0
  return {
    questionIndex,
    maxScore,
    scores,
    lowest,
    highest,
    delta,
    disagree: comparable && delta !== 0,
    comparable,
  }
}

/**
 * Build one comparison per exam question. The exam's question list is the spine
 * so a model that errored (and therefore returned no grades) simply has no entry
 * rather than shortening the report.
 */
export function buildQuestionComparisons(
  results: ModelResult[],
  questionCredits: number[]
): QuestionComparison[] {
  return questionCredits.map((credit, questionIndex) =>
    buildQuestionComparison(results, questionIndex, credit)
  )
}

/**
 * Map a partial grading run back onto the exam's own question numbering.
 *
 * Both a per-question Try and a global Try over a half-finished paper submit a
 * subset of the questions, and the contract does not pin down whether the
 * backend echoes the original `question_index` or renumbers the shortened list
 * from zero. Where every returned index is one we submitted the response is
 * trusted as-is; otherwise the grades are read positionally against the
 * submitted order, which is the only other numbering the backend can be using.
 * Trusting the index blindly would silently attribute a mark to the wrong
 * question, which is worse than showing none.
 */
export function remapResultsToQuestions(
  results: ModelResult[],
  submittedIndexes: number[]
): ModelResult[] {
  const submitted = new Set(submittedIndexes)
  return results.map((result) => {
    if (result.grades.every((grade) => submitted.has(grade.question_index))) {
      return result
    }
    return {
      ...result,
      grades: result.grades.map((grade, position) => ({
        ...grade,
        question_index: submittedIndexes[position] ?? grade.question_index,
      })),
    }
  })
}

export interface AgreementSummary {
  comparable: number
  agreed: number
  disagreed: number
}

export function summariseAgreement(comparisons: QuestionComparison[]): AgreementSummary {
  const comparable = comparisons.filter((c) => c.comparable)
  return {
    comparable: comparable.length,
    agreed: comparable.filter((c) => !c.disagree).length,
    disagreed: comparable.filter((c) => c.disagree).length,
  }
}
