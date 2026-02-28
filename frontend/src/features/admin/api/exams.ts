import type { ExamFormData } from '../schemas/examSchema'

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

export interface ExamResponse {
  id: number
  title: string
  questions: Array<{
    text: string
    credit: number
    min_words: number
    rubric: string[]
  }>
  created_at: string
  updated_at: string
}

export async function fetchExams(): Promise<ExamResponse[]> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/exams/`)
  if (!response.ok) {
    throw new Error(`Failed to fetch exams: ${response.statusText}`)
  }
  return response.json()
}

export async function fetchExam(id: number): Promise<ExamResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/exams/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch exam: ${response.statusText}`)
  }
  return response.json()
}

export async function updateExam(id: number, data: ExamFormData): Promise<ExamResponse> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/exams/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    throw new Error(`Failed to update exam: ${response.statusText}`)
  }
  return response.json()
}
