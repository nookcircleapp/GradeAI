import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

function App() {
  return (
    <div className="container mx-auto p-4 min-h-screen flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">GradeAI</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            AI-powered exam grading with instant feedback
          </p>
          <Button className="w-full">Get Started</Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default App
