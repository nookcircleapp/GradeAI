/**
 * The whole router.
 *
 * There are exactly two pages — the student exam at `/` and the admin dashboard
 * at `/admin` — so this reads `location.pathname` and drives it with the History
 * API instead of pulling in a routing library. The split matters because the two
 * audiences need different links: a student is handed `blinkscore.in`, a teacher
 * is handed `blinkscore.in/admin`, and each lands where they belong on a cold
 * load rather than after clicking a toggle.
 *
 * The pure `viewForPath`/`canonicalPath` pair is deliberately separate from the
 * hook so the URL rules can be exercised without a DOM.
 *
 * Server requirement: the static host must serve `index.html` for unknown paths
 * (nginx `try_files $uri $uri/ /index.html`), or a reload on `/admin` 404s.
 */

import { useCallback, useEffect, useState } from 'react'

export type View = 'student' | 'admin'

const ADMIN_PATH = '/admin'
const STUDENT_PATH = '/'

/**
 * Reduce a pathname to its comparable form: no trailing slash, lower case.
 * `/admin`, `/admin/` and `/Admin` are the same page — people type all three.
 */
function normalise(pathname: string): string {
  // `location.pathname` never carries the query or hash, but a hand-passed
  // string might, and dropping them is cheaper than trusting the caller.
  const withoutSuffix = pathname.split('?')[0].split('#')[0]
  const withoutTrailingSlash = withoutSuffix.replace(/\/+$/, '')
  return withoutTrailingSlash.toLowerCase()
}

/** Which view a URL asks for. Anything unrecognised is the student view. */
export function viewForPath(pathname: string): View {
  return normalise(pathname) === ADMIN_PATH ? 'admin' : 'student'
}

/** The one URL that spells a given view. */
export function pathForView(view: View): string {
  return view === 'admin' ? ADMIN_PATH : STUDENT_PATH
}

/**
 * The tidy spelling of a pathname: `/admin/` becomes `/admin`, and anything
 * unknown becomes `/`.
 *
 * Unknown paths are rewritten rather than merely rendered as the student view,
 * so that a mistyped or stale link does not leave the student page sitting at
 * `/foo` — a URL that would be copied, shared, and only work by accident. The
 * rewrite is a `replaceState`, so it adds no history entry and the back button
 * still leads wherever the visitor came from.
 */
export function canonicalPath(pathname: string): string {
  return pathForView(viewForPath(pathname))
}

function currentPathname(): string {
  // Guarded so the module can be imported (and tested) outside a browser.
  return typeof window === 'undefined' ? STUDENT_PATH : window.location.pathname
}

/**
 * The current view, plus the way to change it.
 *
 * `navigate` pushes a history entry; `popstate` — the browser's back and
 * forward buttons — pulls the state back from the URL. Those are the only two
 * ways `pathname` moves, which is what keeps the two in step: `pushState` does
 * not fire `popstate`, so the setter has to run on both paths.
 */
export function useRoute(): { view: View; navigate: (view: View) => void } {
  // Held canonical, so `/admin/` and `/admin` cannot render as two states.
  const [pathname, setPathname] = useState(() => canonicalPath(currentPathname()))

  useEffect(() => {
    const syncFromLocation = () => setPathname(canonicalPath(window.location.pathname))
    window.addEventListener('popstate', syncFromLocation)
    return () => window.removeEventListener('popstate', syncFromLocation)
  }, [])

  useEffect(() => {
    // Push the tidy spelling back onto the address bar. Nothing reads the URL
    // afterwards — the state above is already canonical — so this only exists
    // so that what the visitor sees and copies is a URL that works.
    if (window.location.pathname === pathname) return
    // Query and hash are kept: they belong to whoever put them there.
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${window.location.search}${window.location.hash}`
    )
  }, [pathname])

  const navigate = useCallback((view: View) => {
    const next = pathForView(view)
    if (window.location.pathname !== next) {
      window.history.pushState(null, '', next)
    }
    setPathname(next)
  }, [])

  return { view: viewForPath(pathname), navigate }
}
