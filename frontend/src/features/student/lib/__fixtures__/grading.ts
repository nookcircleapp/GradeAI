/**
 * Fixtures matching API-CONTRACT.md v1. Test/inspection data only — the app
 * itself always calls the real API.
 */
import type { GradingResponse, ModelInfo, ModelResult } from '../../api/student'

export interface FixtureQuestion {
  text: string
  credit: number
  min_words: number
  rubric: string[]
}

export const questions: FixtureQuestion[] = [
  {
    text: 'Explain how photosynthesis converts light energy into chemical energy.',
    credit: 5,
    min_words: 60,
    rubric: ['Mentions chloroplasts', 'Describes light and dark reactions', 'Names the products'],
  },
  {
    text: 'Describe two ways in which a catalyst affects the rate of a chemical reaction.',
    credit: 4,
    min_words: 40,
    rubric: ['Lowers activation energy', 'Unchanged at the end of the reaction'],
  },
  {
    text: 'Why is groundwater recharge important for agricultural districts in Madhya Pradesh?',
    credit: 6,
    min_words: 80,
    rubric: ['Links rainfall to aquifer levels', 'Connects to irrigation', 'Notes seasonal risk'],
  },
]

export const MAX_SCORE = 15

export const models: ModelInfo[] = [
  {
    id: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    provider: 'openai',
    tier: 'large',
    available: true,
    default_selected: false,
    price_in_per_mtok: 0.25,
    price_out_per_mtok: 2.0,
  },
  {
    id: 'gpt-5',
    label: 'GPT-5',
    provider: 'openai',
    tier: 'large',
    available: false,
    default_selected: false,
    price_in_per_mtok: 1.25,
    price_out_per_mtok: 10.0,
  },
  {
    id: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B Instant',
    provider: 'groq',
    tier: 'small',
    available: true,
    default_selected: true,
    price_in_per_mtok: 0.05,
    price_out_per_mtok: 0.08,
  },
  {
    id: 'gemma2-9b-it',
    label: 'Gemma 2 9B',
    provider: 'groq',
    tier: 'small',
    available: true,
    default_selected: false,
    price_in_per_mtok: 0.2,
    price_out_per_mtok: 0.2,
  },
]

const largeResult: ModelResult = {
  model_id: 'gpt-5-mini',
  label: 'GPT-5 Mini',
  tier: 'large',
  status: 'ok',
  error: null,
  total_score: 12,
  grades: [
    {
      question_index: 0,
      score: 4,
      max_score: 5,
      explanation:
        'Correctly identifies chloroplasts and the light-dependent reactions, and names glucose and oxygen as products. The dark reactions are only alluded to, so one mark is withheld.',
    },
    {
      question_index: 1,
      score: 3,
      max_score: 4,
      explanation:
        'Covers the lowering of activation energy clearly. The point about the catalyst being chemically unchanged is implied rather than stated.',
    },
    {
      question_index: 2,
      score: 5,
      max_score: 6,
      explanation:
        'Strong link between monsoon rainfall, aquifer levels and rabi irrigation. Seasonal risk is mentioned but not quantified.',
    },
  ],
  metrics: {
    latency_ms: 3421,
    prompt_tokens: 850,
    completion_tokens: 220,
    total_tokens: 1070,
    cost_usd: 0.00065,
  },
}

const smallResult: ModelResult = {
  model_id: 'llama-3.1-8b-instant',
  label: 'Llama 3.1 8B Instant',
  tier: 'small',
  status: 'ok',
  error: null,
  total_score: 11,
  grades: [
    {
      question_index: 0,
      score: 4,
      max_score: 5,
      explanation:
        'Chloroplasts and light reactions are both present and the products are named. Marks held back for the missing Calvin cycle detail.',
    },
    {
      question_index: 1,
      score: 2,
      max_score: 4,
      explanation:
        'Only one mechanism is developed. The second effect is asserted without explanation, so half the available marks are awarded.',
    },
    {
      question_index: 2,
      score: 5,
      max_score: 6,
      explanation:
        'Good treatment of recharge and irrigation dependence, with a clear seasonal argument. Slightly thin on district-level consequences.',
    },
  ],
  metrics: {
    latency_ms: 1104,
    prompt_tokens: 850,
    completion_tokens: 240,
    total_tokens: 1090,
    cost_usd: 0.000052,
  },
}

const erroredSmallResult: ModelResult = {
  model_id: 'llama-3.1-8b-instant',
  label: 'Llama 3.1 8B Instant',
  tier: 'small',
  status: 'error',
  error: 'Rate limit exceeded (429). Try again in a few seconds.',
  total_score: null,
  grades: [],
  metrics: null,
}

const erroredLargeResult: ModelResult = {
  model_id: 'gpt-5-mini',
  label: 'GPT-5 Mini',
  tier: 'large',
  status: 'error',
  error: 'Upstream provider timed out after 30s.',
  total_score: null,
  grades: [],
  metrics: null,
}

const thirdResult: ModelResult = {
  model_id: 'gemma2-9b-it',
  label: 'Gemma 2 9B',
  tier: 'small',
  status: 'ok',
  error: null,
  total_score: 12,
  grades: [
    {
      question_index: 0,
      score: 5,
      max_score: 5,
      explanation:
        'All three rubric points are covered, including the Calvin cycle. Full marks.',
    },
    {
      question_index: 1,
      score: 3,
      max_score: 4,
      explanation: 'Both mechanisms appear, though the second is stated rather than justified.',
    },
    {
      question_index: 2,
      score: 4,
      max_score: 6,
      explanation:
        'Recharge and irrigation are connected, but the seasonal risk argument is missing.',
    },
  ],
  metrics: {
    latency_ms: 1890,
    prompt_tokens: 850,
    completion_tokens: 260,
    total_tokens: 1110,
    cost_usd: 0.000222,
  },
}

/** Metrics object present but the provider omitted `usage`. */
const noUsageResult: ModelResult = {
  ...smallResult,
  metrics: {
    latency_ms: 1104,
    prompt_tokens: null,
    completion_tokens: null,
    total_tokens: null,
    cost_usd: null,
  },
}

const base = { max_score: MAX_SCORE, is_final: false, submission_id: null }

/** Normal demo state: one large model, one small model, both succeeded. */
export const twoModelsOk: GradingResponse = {
  ...base,
  submission_id: 7,
  is_final: true,
  results: [largeResult, smallResult],
  comparison: {
    cheapest_model_id: 'llama-3.1-8b-instant',
    fastest_model_id: 'llama-3.1-8b-instant',
    cost_ratio: 12.5,
    speed_ratio: 3.1,
    max_total_score_delta: 1,
  },
}

/** Partial failure: one provider is down, the other still renders normally. */
export const oneOkOneError: GradingResponse = {
  ...base,
  results: [largeResult, erroredSmallResult],
  comparison: null,
}

/** Defensive: contract says this is a non-200, but the view must not crash. */
export const allErrored: GradingResponse = {
  ...base,
  results: [erroredLargeResult, erroredSmallResult],
  comparison: null,
}

/** Single model — degrades to the classic single-column report. */
export const singleModelOk: GradingResponse = {
  ...base,
  results: [largeResult],
  comparison: null,
}

export const singleModelError: GradingResponse = {
  ...base,
  results: [erroredLargeResult],
  comparison: null,
}

/** Three models, including a question where all three disagree. */
export const threeModels: GradingResponse = {
  ...base,
  results: [largeResult, smallResult, thirdResult],
  comparison: {
    cheapest_model_id: 'llama-3.1-8b-instant',
    fastest_model_id: 'llama-3.1-8b-instant',
    cost_ratio: 12.5,
    speed_ratio: 3.1,
    max_total_score_delta: 1,
  },
}

/** Provider omitted usage: costs and tokens must read "not reported". */
export const missingMetrics: GradingResponse = {
  ...base,
  results: [{ ...largeResult, metrics: null }, noUsageResult],
  comparison: {
    cheapest_model_id: 'llama-3.1-8b-instant',
    fastest_model_id: 'llama-3.1-8b-instant',
    cost_ratio: null,
    speed_ratio: null,
    max_total_score_delta: 1,
  },
}
