import { Toaster } from '@/components/ui/sonner'
import { SupportBanner } from './components/Brand'
import { Link } from './components/Link'
import { useRoute } from './router'
import { HomePage } from './student/HomePage'
import { StudentPaperPage } from './student/StudentPaperPage'
import { LoginPage } from './teacher/LoginPage'
import { PaperEditor } from './teacher/PaperEditor'
import { PapersPage } from './teacher/PapersPage'
import { RecordsPage } from './teacher/RecordsPage'
import { TeachersPage } from './teacher/TeachersPage'
import { TeacherShell } from './teacher/TeacherShell'
import { WinnersPage } from './WinnersPage'

export function PilotApp() {
  const route = useRoute()

  const page = (() => {
    switch (route.name) {
      case 'home':
        return <HomePage />
      case 'paper':
        return <StudentPaperPage key={route.code} code={route.code} />
      case 'winners':
        return <WinnersPage key={route.code} code={route.code} />
      case 'login':
        return <LoginPage />
      case 'papers':
        return <TeacherShell section="papers">{() => <PapersPage />}</TeacherShell>
      case 'editor':
        return <TeacherShell section="papers">{() => <PaperEditor key={route.id} id={route.id} />}</TeacherShell>
      case 'records':
        return <TeacherShell section="papers">{() => <RecordsPage key={route.id} id={route.id} />}</TeacherShell>
      case 'teachers':
        return <TeacherShell section="teachers">{(user) => <TeachersPage me={user} />}</TeacherShell>
      default:
        return (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
            <h1 className="text-2xl font-bold">Page not found</h1>
            <Link href="/" className="font-semibold text-blue-700 underline">Go to the start page</Link>
          </div>
        )
    }
  })()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SupportBanner />
      {page}
      <Toaster />
    </div>
  )
}
