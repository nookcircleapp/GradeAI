import { API_BASE_URL, apiRequest } from '@/lib/api'

// --- Types (mirror backend/app/pilot/schemas.py) -----------------------------

export interface User {
  id: number
  email: string
  name: string
  role: 'admin' | 'teacher'
  is_active: boolean
}

export interface Question {
  text: string
  marks: number
  min_words: number
  rubric: string[]
  reference_answer: string
}

export interface PaperFields {
  title: string
  subject: string
  instructions: string
  questions: Question[]
  time_limit_minutes: number | null
  opens_at: string | null
  closes_at: string | null
  collect_section: boolean
  results_mode: 'immediate' | 'on_release'
  allow_preview: boolean
  is_contest: boolean
  hide_roll_numbers_on_winners: boolean
  grading_model: string | null
}

export interface Paper extends PaperFields {
  id: number
  owner_id: number
  status: 'draft' | 'open' | 'closed'
  is_template: boolean
  share_code: string
  results_released: boolean
  winners_revealed: boolean
  max_score: number
  submission_count: number
  created_at: string
  updated_at: string
}

export interface PublicPaper {
  title: string
  subject: string
  instructions: string
  questions: { text: string; marks: number; min_words: number }[]
  max_score: number
  time_limit_minutes: number | null
  opens_at: string | null
  closes_at: string | null
  collect_section: boolean
  allow_preview: boolean
  is_contest: boolean
  accepting: boolean
  state: 'not_open' | 'open' | 'closed'
}

export interface StartResponse {
  receipt: string
  started_at: string
  deadline: string | null
}

export interface GradeOut {
  question_index: number
  score: number
  max_score: number
  explanation: string
}

export interface StudentResult {
  status: 'in_progress' | 'grading' | 'graded'
  paper_title: string
  is_contest: boolean
  rank: number | null
  participants: number | null
  student_name: string
  roll_number: string
  submitted_at: string | null
  results_visible: boolean
  total_score: number | null
  max_score: number
  grades: GradeOut[] | null
}

export interface SubmissionRow {
  id: number
  student_name: string
  roll_number: string
  section: string
  status: 'in_progress' | 'grading' | 'graded' | 'failed'
  ai_score: number | null
  final_score: number | null
  max_score: number
  ai_fooled: boolean | null
  question_scores: (number | null)[]
  flagged: boolean
  started_at: string
  submitted_at: string | null
}

export interface StoredGrade {
  question_index: number
  score: number
  max_score: number
  explanation: string
  suspected_manipulation: boolean
}

export interface SubmissionDetail extends SubmissionRow {
  answers: { question_index: number; answer: string }[]
  grades: StoredGrade[] | null
  overrides: Record<string, number>
  teacher_note: string
  grading_model: string | null
  prompt_version: string | null
  grading_error: string | null
}

export interface LeaderboardEntry {
  rank: number
  student_name: string
  roll_number: string | null
  section: string
  score: number
  max_score: number
  submitted_at: string | null
}

export interface WinnersPage {
  title: string
  subject: string
  share_code: string
  participants: number
  grading_model: string
  date: string | null
  max_score: number
  entries: LeaderboardEntry[]
}

export interface ModelInfo {
  id: string
  label: string
  provider: string
  tier: string
  available: boolean
}

// --- Requests ----------------------------------------------------------------

function json(method: string, body?: unknown, headers?: Record<string, string>): RequestInit {
  return {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}

const get: RequestInit = { credentials: 'include' }

/** For endpoints that answer 204 No Content. */
async function noContent(path: string, fallback: string, init: RequestInit): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, init)
  if (!response.ok) {
    await apiRequest(path, fallback, init) // rethrows with the server's message
  }
}

export const auth = {
  me: () => apiRequest<User>('/api/pilot/auth/me', 'Not signed in', get),
  config: () => apiRequest<{ google: boolean }>('/api/pilot/auth/config', 'Could not load sign-in options', get),
  /** Full-page navigation target; the API redirects to Google and back. */
  googleStartUrl: (next: string) => `${API_BASE_URL}/api/pilot/auth/google/start?${new URLSearchParams({ next })}`,
  login: (email: string, password: string) =>
    apiRequest<User>('/api/pilot/auth/login', 'Sign-in failed', json('POST', { email, password })),
  logout: () => noContent('/api/pilot/auth/logout', 'Sign-out failed', json('POST')),
  changePassword: (current_password: string, new_password: string) =>
    noContent('/api/pilot/auth/password', 'Could not change password', json('POST', { current_password, new_password })),
}

export const admin = {
  teachers: () => apiRequest<User[]>('/api/pilot/admin/teachers', 'Could not load accounts', get),
  createTeacher: (body: { email: string; name: string; password?: string }) =>
    apiRequest<User>('/api/pilot/admin/teachers', 'Could not create account', json('POST', body)),
  settings: () => apiRequest<{ open_teacher_signup: boolean }>('/api/pilot/admin/settings', 'Could not load settings', get),
  updateSettings: (body: { open_teacher_signup: boolean }) =>
    apiRequest<{ open_teacher_signup: boolean }>('/api/pilot/admin/settings', 'Could not save settings', json('PATCH', body)),
  updateTeacher: (id: number, body: { name?: string; password?: string; is_active?: boolean }) =>
    apiRequest<User>(`/api/pilot/admin/teachers/${id}`, 'Could not update account', json('PATCH', body)),
}

const P = '/api/pilot/papers'

export const papers = {
  list: () => apiRequest<Paper[]>(P, 'Could not load papers', get),
  templates: () => apiRequest<Paper[]>(`${P}/templates`, 'Could not load pre-made papers', get),
  get: (id: number) => apiRequest<Paper>(`${P}/${id}`, 'Could not load paper', get),
  create: (body: Partial<PaperFields>) => apiRequest<Paper>(P, 'Could not create paper', json('POST', body)),
  update: (id: number, body: Partial<PaperFields>) =>
    apiRequest<Paper>(`${P}/${id}`, 'Could not save paper', json('PATCH', body)),
  remove: (id: number) => noContent(`${P}/${id}`, 'Could not delete paper', json('DELETE')),
  copy: (id: number) => apiRequest<Paper>(`${P}/${id}/copy`, 'Could not copy paper', json('POST')),
  setStatus: (id: number, status: Paper['status']) =>
    apiRequest<Paper>(`${P}/${id}/status`, 'Could not change status', json('POST', { status })),
  releaseResults: (id: number, value: boolean) =>
    apiRequest<Paper>(`${P}/${id}/results-released`, 'Could not release results', json('POST', { value })),
  revealWinners: (id: number, value: boolean) =>
    apiRequest<Paper>(`${P}/${id}/winners-revealed`, 'Could not publish winners', json('POST', { value })),
  submissions: (id: number) => apiRequest<SubmissionRow[]>(`${P}/${id}/submissions`, 'Could not load records', get),
  submission: (id: number, sid: number) =>
    apiRequest<SubmissionDetail>(`${P}/${id}/submissions/${sid}`, 'Could not load answers', get),
  review: (
    id: number,
    sid: number,
    body: { overrides?: Record<string, number | null>; teacher_note?: string; ai_fooled?: boolean | null }
  ) => apiRequest<SubmissionDetail>(`${P}/${id}/submissions/${sid}`, 'Could not save review', json('PATCH', body)),
  regrade: (id: number, sid: number) =>
    apiRequest<SubmissionRow>(`${P}/${id}/submissions/${sid}/regrade`, 'Could not regrade', json('POST')),
  resetAttempt: (id: number, sid: number) =>
    noContent(`${P}/${id}/submissions/${sid}`, 'Could not reset attempt', json('DELETE')),
  leaderboard: (id: number) => apiRequest<LeaderboardEntry[]>(`${P}/${id}/leaderboard`, 'Could not load leaderboard', get),
  exportUrl: (id: number) => `${API_BASE_URL}${P}/${id}/export.csv`,
}

export const models = {
  list: () => apiRequest<ModelInfo[]>('/api/models', 'Could not load models', get),
}

const S = '/api/pilot/p'
const receiptHeader = (receipt: string) => ({ 'X-Receipt': receipt })

export const student = {
  paper: (code: string) => apiRequest<PublicPaper>(`${S}/${encodeURIComponent(code)}`, 'Paper not found'),
  start: (code: string, body: { student_name: string; roll_number: string; section: string }) =>
    apiRequest<StartResponse>(`${S}/${encodeURIComponent(code)}/start`, 'Could not start', json('POST', body)),
  submit: (code: string, receipt: string, answers: { question_index: number; answer: string }[]) =>
    apiRequest<StudentResult>(
      `${S}/${encodeURIComponent(code)}/submit`,
      'Could not submit',
      json('POST', { answers }, receiptHeader(receipt))
    ),
  result: (code: string, receipt: string) =>
    apiRequest<StudentResult>(`${S}/${encodeURIComponent(code)}/result`, 'Could not load result', {
      headers: receiptHeader(receipt),
    }),
  preview: (code: string, receipt: string, question_index: number, answer: string) =>
    apiRequest<GradeOut>(
      `${S}/${encodeURIComponent(code)}/preview`,
      'Could not preview',
      json('POST', { question_index, answer }, receiptHeader(receipt))
    ),
  winners: (code: string) =>
    apiRequest<WinnersPage>(`${S}/${encodeURIComponent(code)}/winners`, 'Winners not announced yet'),
}
