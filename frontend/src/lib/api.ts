// Where the API lives.
//   - An explicitly-set VITE_API_URL always wins (split-host deploys: the
//     frontend on a CDN, the API on its own hostname).
//   - Otherwise, in a production build the base is the EMPTY STRING, so every
//     request is a same-origin relative URL ("/api/...") that the reverse proxy
//     in front of the static files forwards to uvicorn. It must not be "/",
//     which would produce protocol-relative "//api/..." URLs.
//   - Otherwise (dev), fall back to the local uvicorn on port 8000.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '')

// Must comfortably exceed the server's own grading budget, or the browser
// aborts a request the backend is still happily working on and the user sees a
// bogus "Request timed out". The backend allows 60s per provider call with up
// to 2 attempts and nginx allows 300s, so 30s was well under the real ceiling.
const TIMEOUT_MS = 60_000

export async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
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

// FastAPI reports failures as {"detail": "..."} — or, for request validation,
// {"detail": [{"msg": "...", ...}]}. Pull out a readable message if we can.
async function readErrorDetail(response: Response): Promise<string | null> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return null
  }
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string' && detail.trim() !== '') {
    return detail
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) =>
        typeof item === 'object' && item !== null && 'msg' in item
          ? String((item as { msg: unknown }).msg)
          : null
      )
      .filter((msg): msg is string => msg !== null && msg !== '')
    if (messages.length > 0) {
      return messages.join('; ')
    }
  }
  return null
}

/**
 * Issue a request against the API and return the parsed JSON body.
 * On a non-OK response the backend's `detail` message is surfaced when present,
 * otherwise `fallbackMessage` is combined with the HTTP status text.
 */
export async function apiRequest<T>(
  path: string,
  fallbackMessage: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, options)
  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new Error(detail ?? `${fallbackMessage}: ${response.statusText || response.status}`)
  }
  return response.json() as Promise<T>
}
