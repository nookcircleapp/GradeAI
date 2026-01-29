import { z } from 'zod'

const questionSchema = z.object({
  text: z.string().min(1, "Question text is required"),
  credit: z.coerce.number(),
  min_words: z.coerce.number(),
  rubric: z.array(z.string().min(1, "Rubric point cannot be empty")).min(1, "At least one rubric point")
})

export const examSchema = z.object({
  title: z.string().min(1, "Title is required"),
  questions: z.array(questionSchema).length(3, "Must have exactly 3 questions")
})

export type ExamFormData = z.infer<typeof examSchema>
export type QuestionFormData = z.infer<typeof questionSchema>
