import { useEffect, useState, type ReactNode } from 'react'
import { LogOut } from 'lucide-react'

import { ApiError } from '@/lib/api'
import { Wordmark } from '../components/Brand'
import { Link } from '../components/Link'
import { Spinner } from '../components/Spinner'
import { auth, type User } from '../api'
import { navigate } from '../router'

type Section = 'papers' | 'teachers'

interface Props {
  section: Section
  children: (user: User) => ReactNode
}

/** Header and sign-in guard for every teacher page. */
export function TeacherShell({ section, children }: Props) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    auth
      .me()
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`, true)
        }
      })
  }, [])

  const signOut = async () => {
    await auth.logout().catch(() => undefined)
    navigate('/login', true)
  }

  const tab = (name: Section, href: string, label: string) => (
    <Link
      href={href}
      aria-current={section === name ? 'page' : undefined}
      className={`rounded-lg px-3 py-2 text-sm no-underline ${
        section === name ? 'bg-blue-50 font-semibold text-blue-700' : 'font-medium text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <div className="min-h-[calc(100vh-28px)] bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
          <Link href="/t" className="no-underline">
            <Wordmark pilot />
          </Link>
          <nav className="flex flex-wrap gap-1" aria-label="Teacher">
            {tab('papers', '/t', 'Papers')}
            {user?.role === 'admin' && tab('teachers', '/t/teachers', 'Teachers')}
          </nav>
          {user && (
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-slate-600">{user.name}</span>
              <button
                type="button"
                onClick={signOut}
                aria-label="Sign out"
                className="inline-flex size-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </header>
      {user ? children(user) : <Spinner />}
    </div>
  )
}
