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
        {/* The council crest is landscape (233x145) and carries its own
            wordmark, so it is sized by height with the width left to follow —
            forcing it square would distort the seal. width/height are the
            intrinsic pixels: the classes win on actual size, but the browser
            reserves the right box before the PNG lands, so the bar does not
            jump. Slightly smaller below sm to leave room for the toggle. */}
        <img
          src="/mpcst-logo.png"
          alt="Madhya Pradesh Council of Science & Technology"
          width={233}
          height={145}
          className="h-9 w-auto flex-shrink-0 sm:h-11"
        />

        {/* Keeps the sponsor's mark from reading as part of the BlinkScore
            wordmark. Dropped below sm, where the width matters more. */}
        <div className="hidden h-8 w-px flex-shrink-0 bg-border sm:block" aria-hidden="true" />

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
