import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { AdminView } from '@/features/admin/AdminView'
import { StudentView } from '@/features/student/StudentView'

function App() {
  const [view, setView] = useState<'admin' | 'student'>('student')

  // Verify backend connectivity on mount
  useEffect(() => {
    fetch('http://localhost:8000/health')
      .then(res => res.json())
      .then(data => {
        console.log('Backend health check:', data)
      })
      .catch(err => {
        console.error('Backend health check failed:', err)
      })
  }, [])

  const toggleView = () => {
    setView(view === 'admin' ? 'student' : 'admin')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b print:hidden">
        <div className="container mx-auto p-4 lg:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">GradeAI</h1>
          <Button onClick={toggleView} variant="outline">
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
