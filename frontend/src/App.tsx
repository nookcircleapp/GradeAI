import { useEffect } from 'react'
import { AppHeader } from '@/components/layout/AppHeader'
import { SupportBanner } from '@/components/layout/SupportBanner'
import { Toaster } from '@/components/ui/sonner'
import { API_BASE_URL } from '@/lib/api'
import { useRoute } from '@/lib/routing'
import { AdminView } from '@/features/admin/AdminView'
import { StudentView } from '@/features/student/StudentView'

function App() {
  // `/demo` is the exam, `/demo/admin` is the dashboard. See src/lib/routing.ts.
  const { view, navigate } = useRoute()

  // Verify backend connectivity on mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/health`)
      .then(res => res.json())
      .then(data => {
        console.log('Backend health check:', data)
      })
      .catch(err => {
        console.error('Backend health check failed:', err)
      })
  }, [])

  // Changes the URL rather than a flag, so the other side is linkable and the
  // back button undoes the switch. The admin password lives in sessionStorage
  // and is untouched here: flipping to the student view and back does not
  // re-prompt.
  const toggleView = () => {
    navigate(view === 'admin' ? 'student' : 'admin')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SupportBanner />
      <AppHeader view={view} onToggleView={toggleView} />

      <main>
        {view === 'admin' ? <AdminView /> : <StudentView />}
      </main>
      <Toaster />
    </div>
  )
}

export default App
