import { apiRequest } from '@/lib/api'
import type { ExamResponse } from '../../admin/api/exams'

export type { ExamResponse }

/* -------------------------------------------------------------------------- */
/* Types — mirror API-CONTRACT.md v1                                          */
/* -------------------------------------------------------------------------- */

/**
 * `large` and `small` are LLM scale bands. `local` is a third thing entirely —
 * not a smaller language model but no language model at all: a sentence
 * embedding model running on the server's own CPU, at no API cost and with no
 * explanation to give. It gets its own band rather than being filed under
 * `small`, which would imply a like-for-like comparison that is not what is
 * being shown.
 */
export type ModelTier = 'large' | 'small' | 'local'

/** `GET /api/models` — one entry per model in the backend registry. */
export interface ModelInfo {
  id: string
  label: string
  provider: string
  tier: ModelTier
  /** False when the provider's API key is not configured. Never selectable. */
  available: boolean
  /**
   * The backend registry's opinion about which models to pre-tick on load.
   * Expensive models are deliberately false: they stay selectable in the picker
   * but are never billed by a casual click on Try.
   */
  default_selected: boolean
  price_in_per_mtok: number
  price_out_per_mtok: number
}

export interface AnswerInput {
  question_index: number
  answer: string
}

export interface GradeResult {
  question_index: number
  score: number
  max_score: number
  explanation: string
}

/**
 * Per-model usage. The contract allows token fields and `cost_usd` to be null
 * when a provider omits its `usage` object — never estimate, render "not reported".
 * `latency_ms` is measured client-side of the provider so it is normally present;
 * typed nullable defensively so a missing value degrades instead of printing NaN.
 */
export interface ModelMetrics {
  latency_ms: number | null
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  cost_usd: number | null
}

/**
 * One model's independent grading run. `status: "error"` carries a short human
 * readable `error`, `total_score: null`, `grades: []` and `metrics: null`,
 * and still arrives inside a 200 response.
 */
export interface ModelResult {
  model_id: string
  label: string
  tier: ModelTier
  status: 'ok' | 'error'
  error: string | null
  total_score: number | null
  grades: GradeResult[]
  metrics: ModelMetrics | null
}

/**
 * Null when fewer than two models returned `status: "ok"`.
 * Every field is nullable: the backend emits null for any figure it could not
 * compute (e.g. a provider that reported no token usage).
 */
export interface ComparisonSummary {
  /** The cheapest run, free runs included — so this can be a $0.00 model. */
  cheapest_model_id: string | null
  fastest_model_id: string | null
  /**
   * Most expensive successful run ÷ the cheapest run THAT CHARGED. Null when
   * costs were not reported, or when fewer than two runs cost anything — a
   * multiple against $0.00 is undefined, and the backend sends null rather than
   * an Infinity that would render as garbage.
   */
  cost_ratio: number | null
  /**
   * Which model `cost_ratio` is measured from. Usually the same as
   * `cheapest_model_id`; it differs when the genuinely cheapest run was free.
   */
  cost_ratio_baseline_model_id: string | null
  /** Slowest successful run ÷ fastest. Null if latency was not reported. */
  speed_ratio: number | null
  /** max(total_score) − min(total_score) across successful models. */
  max_total_score_delta: number | null
}

export interface GradingResponse {
  max_score: number
  is_final: boolean
  /** Null for `/preview`; the persisted row id for `/api/submissions/`. */
  submission_id: number | null
  results: ModelResult[]
  comparison: ComparisonSummary | null
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                   */
/* -------------------------------------------------------------------------- */

export async function fetchActiveExam(): Promise<ExamResponse> {
  const exams = await apiRequest<ExamResponse[]>('/api/exams/', 'Failed to fetch exams')
  if (exams.length === 0) {
    throw new Error('No active exam found')
  }
  return exams[0]
}

export async function fetchModels(): Promise<ModelInfo[]> {
  return apiRequest<ModelInfo[]>('/api/models', 'Failed to load the model registry')
}

// `model_ids` is optional in the contract: omitting it falls back to the backend's
// configured default model. Only send the key when we actually have a selection.
function gradingBody(examId: number, answers: AnswerInput[], modelIds?: string[]) {
  return JSON.stringify(
    modelIds && modelIds.length > 0
      ? { exam_id: examId, answers, model_ids: modelIds }
      : { exam_id: examId, answers }
  )
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function previewGrading(
  examId: number,
  answers: AnswerInput[],
  modelIds?: string[]
): Promise<GradingResponse> {
  return apiRequest<GradingResponse>('/api/submissions/preview', 'Failed to preview grading', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: gradingBody(examId, answers, modelIds),
  })
}

export async function submitExam(
  examId: number,
  answers: AnswerInput[],
  modelIds?: string[]
): Promise<GradingResponse> {
  return apiRequest<GradingResponse>('/api/submissions/', 'Failed to submit exam', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: gradingBody(examId, answers, modelIds),
  })
}
