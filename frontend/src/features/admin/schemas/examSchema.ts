import { z } from 'zod'

// Number inputs registered with `valueAsNumber` produce NaN when cleared, which
// Zod reports as a generic invalid_type issue — give it a clear message instead.
const numberField = (label: string) =>
  z.number({
    error: (issue) =>
      Number.isNaN(issue.input) ? `${label} is required` : `${label} must be a number`
  })

/**
 * A teacher may supply at most this many reference answers per question.
 *
 * The only cap in the system: the backend's `QuestionSchema.reference_answers`
 * is an unbounded `list[str]`, so this number is a UI judgement about how many
 * model answers are useful to the grader, not a server constraint. Defined here
 * and imported wherever it is enforced or mentioned — never re-typed.
 */
export const MAX_REFERENCE_ANSWERS = 5

const questionSchema = z.object({
  text: z.string().min(1, "Question text is required"),
  credit: numberField("Credits").int("Credits must be a whole number").min(0, "Credits cannot be negative"),
  min_words: numberField("Min words").int("Min words must be a whole number").min(0, "Min words cannot be negative"),
  rubric: z.array(z.string().min(1, "Rubric point cannot be empty")).min(1, "At least one rubric point"),
  // Examples of full-credit work, used for grading and never shown to students.
  // Optional throughout: an absent key and an empty array are both valid, so an
  // exam that predates the field still validates.
  reference_answers: z
    .array(z.string().min(1, "Reference answer cannot be empty"))
    .max(MAX_REFERENCE_ANSWERS, `At most ${MAX_REFERENCE_ANSWERS} reference answers per question`)
    .optional()
})

export const examSchema = z.object({
  title: z.string().min(1, "Title is required"),
  questions: z.array(questionSchema).min(1, "At least one question is required")
})

export type ExamFormData = z.infer<typeof examSchema>
export type QuestionFormData = z.infer<typeof questionSchema>
