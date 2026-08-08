import { useEffect } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { API_BASE_URL } from '@/lib/api'
import { useRoute } from '@/lib/routing'
import { AdminView } from '@/features/admin/AdminView'
import { StudentView } from '@/features/student/StudentView'

function App() {
  // `/` is the exam, `/admin` is the dashboard. See src/lib/routing.ts.
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
    <div className="min-h-screen bg-background">
      <header className="border-b print:hidden">
        <div className="container mx-auto p-4 lg:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">GradeAI</h1>
          {/* The toggle stays available either way — the padlock says the admin
              side asks for a password, it does not hide that the side exists. */}
          <Button onClick={toggleView} variant="outline" className="gap-2">
            {view === 'student' && <Lock className="size-3.5" />}
            Switch to {view === 'admin' ? 'Student' : 'Admin'} View
          </Button>
        </div>
      </header>

      <main>
        {view === 'admin' ? <AdminView /> : <StudentView />}
      </main>
      <Toaster />
    </div>
  )
}

export default App
