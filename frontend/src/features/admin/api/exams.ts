import { ApiError, apiRequest } from '@/lib/api'
import type { ExamFormData } from '../schemas/examSchema'
import { clearAdminToken } from '../lib/adminToken'

/**
 * The public exam shape — everything an anonymous read returns, and everything
 * the student view is allowed to know about. Reference answers are deliberately
 * absent here so no student-facing type can reach them.
 */
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
 * The same exam as returned to an authenticated admin: the public fields plus
 * the teacher-only ones. `reference_answers` stays optional because an
 * unauthenticated read omits the key entirely, and because an exam written
 * before the field existed simply has none.
 */
export interface AdminExamResponse extends Omit<ExamResponse, 'questions'> {
  questions: Array<
    ExamResponse['questions'][number] & {
      /** Full-credit examples. Grading input only — never sent to students. */
      reference_answers?: string[]
    }
  >
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
 * The admin dashboard's only read, and the password check it performs on the
 * way in.
 *
 * The full exam lives behind its own endpoint rather than behind a header on
 * the public one: `/api/exams/admin` returns `reference_answers` and answers
 * 401 without a valid token, while `/api/exams/` serializes through a schema
 * that has no such field and so cannot leak them. There is deliberately no
 * fallback to the public read — a form holding an exam whose reference answers
 * it never received would erase them on the next save.
 */
export async function fetchAdminExams(adminToken: string): Promise<AdminExamResponse[]> {
  return adminRequest<AdminExamResponse[]>('/api/exams/admin', 'Failed to fetch exams', adminToken)
}

/**
 * Run a request with the shared admin secret attached, converting a 401 into an
 * AdminAuthError and dropping the bad token on the way out. Used by exam writes
 * and by the admin read that returns the teacher-only fields; every student
 * request stays anonymous.
 */
async function adminRequest<T>(
  path: string,
  fallbackMessage: string,
  adminToken: string,
  init: RequestInit = {}
): Promise<T> {
  try {
    return await apiRequest<T>(path, fallbackMessage, {
      ...init,
      headers: {
        ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
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
  return adminRequest<ExamResponse>(`/api/exams/${id}`, 'Failed to update exam', adminToken, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}
