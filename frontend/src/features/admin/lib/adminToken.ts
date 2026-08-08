/**
 * Where the admin password lives in the browser.
 *
 * `sessionStorage`, deliberately:
 *   - It is scoped to the one tab and cleared when that tab closes, so the
 *     password does not outlive the sitting. On a shared demo laptop closing
 *     the tab is the whole logout story.
 *   - It survives a reload and every save in between, so the admin types the
 *     password once per session rather than once per save.
 *   - It is not sent automatically with any request (unlike a cookie), so it
 *     cannot be replayed by a cross-site request — only code that explicitly
 *     reads it can attach it, and only the exam write calls do.
 *
 * `localStorage` would leave the password on disk indefinitely; React state
 * alone would re-prompt on every refresh. This sits in between, which is the
 * right trade for a shared secret guarding one form.
 *
 * Access is wrapped in try/catch because sessionStorage throws in private
 * browsing modes and when storage is disabled; the admin then just gets
 * prompted on each save, which still works.
 */

const STORAGE_KEY = 'gradeai.adminToken'

export function getAdminToken(): string | null {
  try {
    const token = sessionStorage.getItem(STORAGE_KEY)
    return token !== null && token !== '' ? token : null
  } catch {
    return null
  }
}

export function setAdminToken(token: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, token)
  } catch {
    // Storage unavailable — the caller still holds the token for this save.
  }
}

export function clearAdminToken(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do: if we cannot write, there is nothing stored to clear.
  }
}
