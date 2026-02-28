import type { ExamResponse } from '../../admin/api/exams'

export type { ExamResponse }

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TIMEOUT_MS = 30_000

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    return response
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
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

export interface GradingResponse {
  grades: GradeResult[]
  total_score: number
  max_score: number
  is_final: boolean
}

export async function fetchActiveExam(): Promise<ExamResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/exams/`)
  if (!response.ok) {
    throw new Error(`Failed to fetch exams: ${response.statusText}`)
  }
  const exams: ExamResponse[] = await response.json()
  if (exams.length === 0) {
    throw new Error('No active exam found')
  }
  return exams[0]
}

export async function previewGrading(
  examId: number,
  answers: AnswerInput[]
): Promise<GradingResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/submissions/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ exam_id: examId, answers }),
  })
  if (!response.ok) {
    throw new Error(`Failed to preview grading: ${response.statusText}`)
  }
  return response.json()
}

export async function submitExam(
  examId: number,
  answers: AnswerInput[]
): Promise<GradingResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/submissions/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ exam_id: examId, answers }),
  })
  if (!response.ok) {
    throw new Error(`Failed to submit exam: ${response.statusText}`)
  }
  return response.json()
}
