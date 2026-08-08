import { z } from 'zod'

// Number inputs registered with `valueAsNumber` produce NaN when cleared, which
// Zod reports as a generic invalid_type issue — give it a clear message instead.
const numberField = (label: string) =>
  z.number({
    error: (issue) =>
      Number.isNaN(issue.input) ? `${label} is required` : `${label} must be a number`
  })

const questionSchema = z.object({
  text: z.string().min(1, "Question text is required"),
  credit: numberField("Credits").int("Credits must be a whole number").min(0, "Credits cannot be negative"),
  min_words: numberField("Min words").int("Min words must be a whole number").min(0, "Min words cannot be negative"),
  rubric: z.array(z.string().min(1, "Rubric point cannot be empty")).min(1, "At least one rubric point")
})

export const examSchema = z.object({
  title: z.string().min(1, "Title is required"),
  questions: z.array(questionSchema).min(1, "At least one question is required")
})

export type ExamFormData = z.infer<typeof examSchema>
export type QuestionFormData = z.infer<typeof questionSchema>
