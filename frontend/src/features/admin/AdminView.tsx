import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function AdminView() {
  return (
    <div className="w-full container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage exams and questions</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exam Management</CardTitle>
          <CardDescription>Create and manage exams</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Exam management coming in Phase 2
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
