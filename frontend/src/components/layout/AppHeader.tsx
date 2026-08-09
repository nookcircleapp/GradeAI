import { Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { View } from '@/lib/routing'

/** The one line under the wordmark that says which side of the app you are on. */
const TAGLINES: Record<View, string> = {
  student: 'Student Exam',
  admin: 'Admin Dashboard',
}

interface AppHeaderProps {
  /** Which page is showing; only changes the tagline. */
  view: View
  /** Flips to the other view. Wired to the router by App. */
  onToggleView: () => void
}

/**
 * The sticky app bar: logo, wordmark, tagline, and the student/admin toggle.
 *
 * The toggle lives here rather than in either view because it belongs to
 * neither — it is how you get from one to the other. Its padlock on the student
 * side is the whole affordance: the admin page exists and asks for a password,
 * which is different from pretending it is not there.
 */
export function AppHeader({ view, onToggleView }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm print:hidden">
      {/* max-w-6xl / px-4 sm:px-6 is the shell width every view shares, so the
          logo lines up with the left edge of the page content beneath it. Views
          narrow their own reading column inside that shell rather than
          narrowing the shell itself. */}
      <div className="mx-auto flex min-h-[62px] max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6">
        {/* Logo slot — replace div with img once asset is ready:
            <img src="/assets/logo.png" alt="Institution logo" className="h-10 w-auto rounded-lg" /> */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-dashed border-blue-200 bg-gradient-to-br from-blue-100 to-amber-100 text-[9px] font-bold tracking-wide text-blue-700">
          LOGO
        </div>

        <div className="flex min-w-0 flex-col leading-tight">
          <span className="text-xl font-extrabold tracking-tight text-blue-900">
            Blink<span className="text-amber-500">Score</span>
          </span>
          <span className="truncate text-[11.5px] text-slate-500">{TAGLINES[view]}</span>
        </div>

        <div className="flex-1" />

        {/* The toggle stays available either way — the padlock says the admin
            side asks for a password, it does not hide that the side exists. */}
        <Button onClick={onToggleView} variant="outline" size="sm" className="gap-2">
          {view === 'student' && <Lock className="size-3.5" />}
          <span className="hidden sm:inline">
            Switch to {view === 'admin' ? 'Student' : 'Admin'} View
          </span>
          <span className="sm:hidden">{view === 'admin' ? 'Student' : 'Admin'}</span>
        </Button>
      </div>
    </header>
  )
}
