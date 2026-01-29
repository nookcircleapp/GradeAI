import type { ExamFormData } from '../schemas/examSchema'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
  const response = await fetch(`${API_BASE_URL}/api/exams/`)
  if (!response.ok) {
    throw new Error(`Failed to fetch exams: ${response.statusText}`)
  }
  return response.json()
}

export async function fetchExam(id: number): Promise<ExamResponse> {
  const response = await fetch(`${API_BASE_URL}/api/exams/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch exam: ${response.statusText}`)
  }
  return response.json()
}

export async function updateExam(id: number, data: ExamFormData): Promise<ExamResponse> {
  const response = await fetch(`${API_BASE_URL}/api/exams/${id}`, {
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
