import { ApiError, apiRequest } from '@/lib/api'
import type { ExamFormData } from '../schemas/examSchema'
import { clearAdminToken } from '../lib/adminToken'

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

/**
 * Thrown when the backend rejects the admin password on an exam write. By the
 * time this surfaces the stored token has already been discarded, so the
 * caller's job is simply to prompt again.
 */
export class AdminAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminAuthError'
  }
}

// Reads are public — the student flow depends on that, so no token here.
export async function fetchExams(): Promise<ExamResponse[]> {
  return apiRequest<ExamResponse[]>('/api/exams/', 'Failed to fetch exams')
}

export async function fetchExam(id: number): Promise<ExamResponse> {
  return apiRequest<ExamResponse>(`/api/exams/${id}`, 'Failed to fetch exam')
}

/**
 * Run an exam write with the shared admin secret attached, converting a 401
 * into an AdminAuthError and dropping the bad token on the way out.
 */
async function adminWrite<T>(
  path: string,
  fallbackMessage: string,
  adminToken: string,
  init: RequestInit
): Promise<T> {
  try {
    return await apiRequest<T>(path, fallbackMessage, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        // Only exam writes carry this. Reads and every student request stay
        // anonymous.
        'X-Admin-Token': adminToken,
        ...init.headers,
      },
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // The held token is wrong (or the server has none configured); never keep
      // retrying with it silently.
      clearAdminToken()
      throw new AdminAuthError(error.message)
    }
    throw error
  }
}

export async function updateExam(
  id: number,
  data: ExamFormData,
  adminToken: string
): Promise<ExamResponse> {
  return adminWrite<ExamResponse>(`/api/exams/${id}`, 'Failed to update exam', adminToken, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
