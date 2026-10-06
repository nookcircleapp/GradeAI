/**
 * A minimal path router for the pilot UI (History API, no library).
 *
 *   /                       student: enter a join code
 *   /p/:code                student: join, write, see result
 *   /w/:code                public winners page
 *   /login                  teacher sign-in
 *   /t                      teacher: papers
 *   /t/papers/:id           teacher: set a paper
 *   /t/papers/:id/records   teacher: exam records
 *   /t/teachers             admin: teacher accounts
 */
import { useEffect, useState } from 'react'

export type Route =
  | { name: 'home' }
  | { name: 'paper'; code: string }
  | { name: 'winners'; code: string }
  | { name: 'login' }
  | { name: 'papers' }
  | { name: 'editor'; id: number }
  | { name: 'records'; id: number }
  | { name: 'teachers' }
  | { name: 'notFound' }

export function parseRoute(pathname: string): Route {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  const [a, b, c, d] = parts
  if (parts.length === 0) return { name: 'home' }
  if (a === 'p' && b && parts.length === 2) return { name: 'paper', code: b.toUpperCase() }
  if (a === 'w' && b && parts.length === 2) return { name: 'winners', code: b.toUpperCase() }
  if (a === 'login' && parts.length === 1) return { name: 'login' }
  if (a === 't') {
    if (parts.length === 1) return { name: 'papers' }
    if (b === 'teachers' && parts.length === 2) return { name: 'teachers' }
    if (b === 'papers' && c && /^\d+$/.test(c)) {
      if (parts.length === 3) return { name: 'editor', id: Number(c) }
      if (d === 'records' && parts.length === 4) return { name: 'records', id: Number(c) }
    }
  }
  return { name: 'notFound' }
}

const listeners = new Set<() => void>()

export function navigate(path: string, replace = false) {
  if (replace) window.history.replaceState(null, '', path)
  else window.history.pushState(null, '', path)
  window.scrollTo(0, 0)
  listeners.forEach((fn) => fn())
}

export function useRoute(): Route {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const sync = () => setPath(window.location.pathname)
    listeners.add(sync)
    window.addEventListener('popstate', sync)
    return () => {
      listeners.delete(sync)
      window.removeEventListener('popstate', sync)
    }
  }, [])
  return parseRoute(path)
}
