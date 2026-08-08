import { apiRequest } from '@/lib/api'
import type { ExamFormData } from '../schemas/examSchema'

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
  return apiRequest<ExamResponse[]>('/api/exams/', 'Failed to fetch exams')
}

export async function fetchExam(id: number): Promise<ExamResponse> {
  return apiRequest<ExamResponse>(`/api/exams/${id}`, 'Failed to fetch exam')
}

export async function updateExam(id: number, data: ExamFormData): Promise<ExamResponse> {
  return apiRequest<ExamResponse>(`/api/exams/${id}`, 'Failed to update exam', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
}
