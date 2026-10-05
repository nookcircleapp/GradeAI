/**
 * The student's attempt, kept in localStorage per paper code so a refresh or a
 * dropped connection never loses answers. The receipt is the only key to the
 * attempt on the server, so losing it means asking the teacher to reset.
 */
export interface Attempt {
  receipt: string
  name: string
  roll: string
  deadline: string | null
  answers: Record<number, string>
  current: number
  submitted: boolean
}

const key = (code: string) => `blinkscore:attempt:${code}`

export function loadAttempt(code: string): Attempt | null {
  try {
    const raw = localStorage.getItem(key(code))
    return raw ? (JSON.parse(raw) as Attempt) : null
  } catch {
    return null
  }
}

export function saveAttempt(code: string, attempt: Attempt) {
  try {
    localStorage.setItem(key(code), JSON.stringify(attempt))
  } catch {
    // Storage full or disabled: the attempt still works for this page load.
  }
}

export function clearAttempt(code: string) {
  try {
    localStorage.removeItem(key(code))
  } catch {
    // ignore
  }
}
