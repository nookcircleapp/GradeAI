import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function StudentView() {
  return (
    <div className="w-full container mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Student Dashboard</h1>
        <p className="text-muted-foreground">Take exams and view results</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exam Taking</CardTitle>
          <CardDescription>Start an exam and view your results</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Exam taking coming in Phase 3
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
